import psycopg2

try:
    conn = psycopg2.connect('host=localhost dbname=FinCore user=postgres password=postgres')
    cur = conn.cursor()

    cur.execute('SELECT "Id", "Name", "Email", "Role", "PhoneNumber" FROM "Users";')
    users = cur.fetchall()
    print('Users in DB:')
    for u in users:
        print(u)

    cur.execute('SELECT "Id", "UserId", "Balance" FROM "Wallets";')
    wallets = cur.fetchall()
    print('\nWallets in DB:')
    for w in wallets:
        print(w)

    conn.close()
except Exception as e:
    print('Error:', e)
