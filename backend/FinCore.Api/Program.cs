using System.Text;
using FinCore.Api.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using FinCore.Api.Services.FraudService;
using FinCore.Api.Services.NotificationService;
using Microsoft.SemanticKernel;

using FinCore.Api.Hubs;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// Configure dynamic port binding (Render assigns a dynamic PORT environment variable)
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
{
    builder.WebHost.UseUrls($"http://+:{port}");
}

// 1. Configure the CORS policy to allow your Vite frontend and Vercel Deployment
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173", // Local dev Vite
                "http://localhost:5174", // Local dev alternative
                "https://fin-core-se3090.vercel.app"  // Live Vercel domain
            )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddSignalR();
builder.Services.AddSwaggerGen();
builder.Services.AddControllers();
builder.Services.AddHttpClient();
builder.Services.AddHttpClient<IGeolocationService, GeolocationService>();
builder.Services.AddScoped<IFraudService, FraudService>();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<BrevoNotificationService>();
builder.Services.AddScoped<INotificationService>(sp => sp.GetRequiredService<BrevoNotificationService>());
builder.Services.AddScoped<IEmailService>(sp => sp.GetRequiredService<BrevoNotificationService>());
builder.Services.AddScoped<TwilioNotificationService>();
builder.Services.AddScoped<MockNotificationService>();
builder.Services.AddTransient<Kernel>(sp =>
{
    var kernelBuilder = Kernel.CreateBuilder();
    
    // Configures the Kernel to use OpenAI. 
    // It will look for a key in your appsettings.json, or fall back to the placeholder.
    var apiKey = builder.Configuration["OpenAI:ApiKey"] ?? "YOUR_OPENAI_API_KEY";
    
    kernelBuilder.AddOpenAIChatCompletion(
        modelId: "gpt-4o-mini", // Or whichever model your team is using
        apiKey: apiKey);
        
    return kernelBuilder.Build();
});
builder.Services.AddScoped<IAnomalyDetectionAgent, AnomalyDetectionAgent>();

// Resolve database connection string from DefaultConnection, DATABASE_URL (Render/Neon), or SQLite fallback
var rawConnStr = builder.Configuration.GetConnectionString("DefaultConnection")
                 ?? builder.Configuration["DATABASE_URL"]
                 ?? builder.Configuration["ConnectionStrings__DefaultConnection"]
                 ?? "Data Source=fincore.db";

var dbProvider = builder.Configuration["DbProvider"];
var isPostgres = string.Equals(dbProvider, "Postgres", StringComparison.OrdinalIgnoreCase)
                 || rawConnStr.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
                 || rawConnStr.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)
                 || rawConnStr.Contains("Host=", StringComparison.OrdinalIgnoreCase)
                 || rawConnStr.Contains("Username=", StringComparison.OrdinalIgnoreCase);

var connStr = isPostgres ? NormalizePostgresConnectionString(rawConnStr) : rawConnStr;

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (isPostgres)
    {
        options.UseNpgsql(connStr, npgsqlOptions =>
        {
            // Resilient retry logic for serverless Neon Postgres wake-up
            npgsqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(10),
                errorCodesToAdd: null);
        });
    }
    else
    {
        options.UseSqlite(connStr.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase) ? connStr : "Data Source=fincore.db");
    }
});

// Configure JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "your-super-secret-key-that-is-long-enough";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "FinCore";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };
});

var app = builder.Build();

// Configure Forwarded Headers for reverse proxies like Render
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        logger.LogInformation("Initializing database ({Provider})...", isPostgres ? "PostgreSQL" : "SQLite");
        if (isPostgres)
        {
            try
            {
                await db.Database.MigrateAsync();
                logger.LogInformation("Database EF Core migrations applied successfully.");
            }
            catch (Exception ex)
            {
                logger.LogWarning("MigrateAsync fallback to EnsureCreated: {Message}", ex.Message);
                db.Database.EnsureCreated();
            }
        }
        else
        {
            db.Database.EnsureCreated();
        }

        await DbInitializer.InitializeAsync(db);
        logger.LogInformation("Database initialized and seed data ready.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to initialize or migrate database on startup.");
    }
}

// Enable Swagger in Development or if explicitly enabled (defaults to true for easy API testing)
var enableSwagger = builder.Configuration.GetValue<bool>("EnableSwagger", true);
if (app.Environment.IsDevelopment() || enableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI(); 
}

if (!app.Environment.IsProduction())
{
    app.UseHttpsRedirection();
}

// 1. ADD THIS LINE: Explicitly build the routing tree first
app.UseRouting();

// 2. Apply the CORS policy immediately after routing, before Auth
app.UseCors("AllowFrontend");

// 3. Apply Authentication & Authorization
app.UseAuthentication();
app.UseAuthorization();

// Root and Health Check endpoints for Render and ping diagnostics
app.MapGet("/", () => Results.Ok(new
{
    status = "Online",
    service = "FinCore Banking Security & Fraud Detection API",
    database = isPostgres ? "PostgreSQL (Neon)" : "SQLite",
    documentation = "/swagger",
    timestamp = DateTime.UtcNow
}));

app.MapGet("/health", () => Results.Ok(new
{
    status = "Healthy",
    timestamp = DateTime.UtcNow
}));

app.MapControllers();
app.MapHub<TransactionHub>("/hubs/transactions");

app.Run();

static string NormalizePostgresConnectionString(string connectionString)
{
    if (string.IsNullOrWhiteSpace(connectionString))
        return connectionString;

    var trimmed = connectionString.Trim();
    if (trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
        trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        try
        {
            var uri = new Uri(trimmed);
            var userInfo = uri.UserInfo.Split(':', 2);
            var username = Uri.UnescapeDataString(userInfo[0]);
            var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
            var port = uri.Port > 0 ? uri.Port : 5432;
            var database = uri.AbsolutePath.TrimStart('/');

            return $"Host={uri.Host};Port={port};Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true;";
        }
        catch
        {
            return connectionString;
        }
    }

    return connectionString;
}

public partial class Program { }