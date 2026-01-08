import { db } from './db'; // Твой инстанс drizzle
    import { merchants, customers } from './entities';

async function seed() {
   await db.insert(merchants)
     .values({ id: 12345, username: 'dev_user' }) 
     .onConflictDoNothing();

   await db.insert(customers)
     .values({ merchantId: 12345, name: 'Тестовый Клиент', phone: '+79991234567' });

   console.log('Seed done');
}

seed();