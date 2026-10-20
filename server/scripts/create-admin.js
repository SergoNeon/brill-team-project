import crypto from 'node:crypto';
import { Pool } from 'pg';
import { hashPassword } from '../src/auth.js';
const [username,password]=process.argv.slice(2);
if(!process.env.DATABASE_URL||!username||!password){console.error('Usage: DATABASE_URL=... node scripts/create-admin.js <username> <password>');process.exit(1)}
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true}});
try{await pool.query('INSERT INTO admin_users(id,username,password_hash) VALUES($1,$2,$3)',[crypto.randomUUID(),username,hashPassword(password)]);console.log('Admin created')}finally{await pool.end()}
