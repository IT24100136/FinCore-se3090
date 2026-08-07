Set Up PostgreSQL (Docker — everyone uses the same setup) 


docker run --name FinCore-db -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=FinCore -p 5432:5432 -d postgres:16 


Verify it's running: 

docker ps 