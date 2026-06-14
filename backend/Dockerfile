FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Sicou.sln ./
COPY src/Api/Sicou.Api.csproj src/Api/
COPY src/Application/Sicou.Application.csproj src/Application/
COPY src/Domain/Sicou.Domain.csproj src/Domain/
COPY src/Infrastructure/Sicou.Infrastructure.csproj src/Infrastructure/
COPY tests/Sicou.UnitTests/Sicou.UnitTests.csproj tests/Sicou.UnitTests/
COPY tests/Sicou.IntegrationTests/Sicou.IntegrationTests.csproj tests/Sicou.IntegrationTests/

RUN dotnet restore Sicou.sln

COPY . .

RUN dotnet publish src/Api/Sicou.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "Sicou.Api.dll"]
