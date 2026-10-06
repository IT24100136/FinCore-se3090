import psycopg2

try:
    conn = psycopg2.connect('host=localhost dbname=FinCore user=postgres password=postgres')
    cur = conn.cursor()

    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'Notifications';
    """)
    print('Notifications columns:', cur.fetchall())

    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'Wallets';
    """)
    print('Wallets columns:', cur.fetchall())

    cur.execute('SELECT COUNT(*), COALESCE(SUM("Balance"), 0) FROM "Wallets";')
    print('Wallets count and balance sum:', cur.fetchall())

    cur.execute('SELECT "Id", "UserId", "Balance" FROM "Wallets" LIMIT 5;')
    print('Sample wallets:', cur.fetchall())

    conn.close()
except Exception as e:
    print('Error:', e)
