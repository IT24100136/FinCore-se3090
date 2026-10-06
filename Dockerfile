# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

# Copy csproj and restore dependencies
COPY ["backend/FinCore.Api/FinCore.Api.csproj", "backend/FinCore.Api/"]
RUN dotnet restore "backend/FinCore.Api/FinCore.Api.csproj"

# Copy remaining source code and publish
COPY backend/FinCore.Api/ backend/FinCore.Api/
WORKDIR "/src/backend/FinCore.Api"
RUN dotnet publish "FinCore.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_HTTP_PORTS=8080
ENV ASPNETCORE_ENVIRONMENT=Production

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "FinCore.Api.dll"]
