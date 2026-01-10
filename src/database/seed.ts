import { db } from './db'; // Твой инстанс drizzle
    import { merchants, customers } from './entities';

export async function seed() {
   await db.insert(merchants)
     .values({ id: 12345, username: 'dev_user' }) 
     .onConflictDoNothing();

   await db.insert(customers)
     .values({ merchantId: 12345, name: 'Тестовый Клиент', phone: '+79991234567', inviteToken: 'test_token' });

   console.log('Seed done');
}
