import psycopg2

try:
    conn = psycopg2.connect('host=localhost dbname=FinCore user=postgres password=postgres')
    conn.autocommit = True
    cur = conn.cursor()

    # 1. Add UserGuid to Wallets if not exists
    cur.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='Wallets' AND column_name='UserGuid'
            ) THEN
                ALTER TABLE "Wallets" ADD COLUMN "UserGuid" uuid NULL;
            END IF;
        END $$;
    """)
    print("Added UserGuid to Wallets (or already exists)")

    # 2. Add Title, IsRead, Category to Notifications if not exists
    cur.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='Notifications' AND column_name='Title'
            ) THEN
                ALTER TABLE "Notifications" ADD COLUMN "Title" text NOT NULL DEFAULT '';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='Notifications' AND column_name='IsRead'
            ) THEN
                ALTER TABLE "Notifications" ADD COLUMN "IsRead" boolean NOT NULL DEFAULT false;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='Notifications' AND column_name='Category'
            ) THEN
                ALTER TABLE "Notifications" ADD COLUMN "Category" text NOT NULL DEFAULT 'info';
            END IF;
        END $$;
    """)
    print("Added Title, IsRead, Category to Notifications (or already exists)")

    conn.close()
    print("PostgreSQL migration completed successfully.")
except Exception as e:
    print('Migration Error:', e)
