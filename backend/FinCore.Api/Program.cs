using System.Text;
using FinCore.Api.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using FinCore.Api.Services.FraudService;
using FinCore.Api.Services.NotificationService;
using Microsoft.SemanticKernel;

using FinCore.Api.Hubs;

var builder = WebApplication.CreateBuilder(args);

// 1. Configure the CORS policy to allow your Vite frontend (and Flutter Web)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.SetIsOriginAllowed(origin => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddSignalR();
builder.Services.AddSwaggerGen();
builder.Services.AddControllers();
builder.Services.AddHttpClient<IGeolocationService, GeolocationService>();
builder.Services.AddScoped<IFraudService, FraudService>();
builder.Services.AddScoped<INotificationService, MockNotificationService>();
builder.Services.AddScoped<BrevoNotificationService>();
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

var connStr = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=fincore.db";
var dbProvider = builder.Configuration["DbProvider"];
var isPostgres = string.Equals(dbProvider, "Postgres", StringComparison.OrdinalIgnoreCase)
                 || connStr.Contains("Host=", StringComparison.OrdinalIgnoreCase)
                 || connStr.Contains("Username=", StringComparison.OrdinalIgnoreCase);

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (isPostgres)
    {
        options.UseNpgsql(connStr);
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

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.EnsureCreated();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(); 
}

app.UseHttpsRedirection();

// 2. Apply the CORS policy (Must be placed before MapControllers)
app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<TransactionHub>("/hubs/transactions");

app.Run();

public partial class Program { }
