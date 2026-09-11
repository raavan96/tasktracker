// Pipe one JSON object to stdin. Passwords are never command arguments or logs.
import pg from 'pg';
import { randomBytes,scrypt as callback } from 'node:crypto';
import { promisify } from 'node:util';
let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>8192)throw new Error('Input too large');}
const {email,fullName,password}=JSON.parse(input);
if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||typeof fullName!=='string'||!fullName.trim()||typeof password!=='string'||password.length<8||password.length>256)throw new Error('Provide email, fullName and an 8–256 character password.');
const salt=randomBytes(16).toString('hex');const key=await promisify(callback)(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
try{await db.connect();await db.query('BEGIN');await db.query('SET LOCAL ROLE service_role');await db.query('LOCK TABLE profiles IN EXCLUSIVE MODE');
if((await db.query('SELECT 1 FROM profiles LIMIT 1')).rows.length)throw new Error('Bootstrap requires an empty workspace.');
const {rows}=await db.query('INSERT INTO auth.users(id,email,password_hash) VALUES(gen_random_uuid(),$1,$2) RETURNING id',[email.toLowerCase().trim(),`scrypt-v1$${salt}$${key.toString('hex')}`]);
await db.query("INSERT INTO profiles(id,email,full_name,role) VALUES($1,$2,$3,'admin')",[rows[0].id,email.toLowerCase().trim(),fullName.trim()]);await db.query('COMMIT');console.log('Staging admin created.');}
catch(error){await db.query('ROLLBACK').catch(()=>{});console.error(error.message);process.exitCode=1;}
finally{await db.end();}
