import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { simpleGit } from 'simple-git';

const app=express(),port=Number(process.env.PORT||8787),host=process.env.HOST||'127.0.0.1';
const dataDir=resolve(process.env.DATA_DIR||'./data');mkdirSync(dataDir,{recursive:true});
const db=new Database(join(dataDir,'orbit.sqlite'));db.pragma('journal_mode=WAL');db.pragma('foreign_keys=ON');
db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,github_id TEXT UNIQUE,login TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS repos(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,description TEXT DEFAULT '',visibility TEXT NOT NULL DEFAULT 'private',path TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,UNIQUE(owner_id,name));
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);`);
app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:false}));
app.use(cors({origin:(process.env.CORS_ORIGIN||'http://localhost:5500').split(',').map(s=>s.trim())}));
app.use(express.json({limit:'1mb'}));app.use(rateLimit({windowMs:60000,limit:120,standardHeaders:true,legacyHeaders:false}));
const fail=(res,status,error)=>res.status(status).json({error}),hash=t=>createHash('sha256').update(t).digest('hex');
function auth(req,res,next){const h=req.get('authorization')||'',token=h.startsWith('Bearer ')?h.slice(7):'';if(!token)return fail(res,401,'Требуется авторизация.');const u=db.prepare('SELECT users.id,users.login FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?').get(hash(token),Date.now());if(!u)return fail(res,401,'Сессия недействительна. OAuth ещё не подключён.');req.user=u;next()}
function repoFor(req,res){const r=db.prepare('SELECT * FROM repos WHERE id=? AND owner_id=?').get(req.params.id,req.user.id);if(!r)fail(res,404,'Репозиторий не найден.');return r}
const safeName=n=>typeof n==='string'&&/^[a-zA-Z0-9._-]{1,80}$/.test(n)&&n!=='.'&&n!=='..'?n:null;
const gitAt=r=>simpleGit(r.path);
app.get('/api/health',(_q,res)=>res.json({ok:true,service:'Orbit Git API',version:'0.1.0',time:new Date().toISOString()}));
app.get('/api',(_q,res)=>res.json({name:'Orbit Git API',health:'/api/health',routes:['GET/POST /api/repos','GET /api/repos/:id/files','GET/PUT /api/repos/:id/file','GET/POST /api/repos/:id/commits']}));
app.get('/api/me',auth,(req,res)=>res.json({id:req.user.id,login:req.user.login}));
app.get('/api/repos',auth,(req,res)=>res.json({repositories:db.prepare('SELECT id,name,description,visibility,created_at FROM repos WHERE owner_id=? ORDER BY created_at DESC').all(req.user.id)}));
app.post('/api/repos',auth,async(req,res)=>{try{const name=safeName(req.body?.name);if(!name)return fail(res,400,'Название: латиница, цифры, точка, дефис или подчёркивание; до 80 символов.');if(db.prepare('SELECT 1 FROM repos WHERE owner_id=? AND name=?').get(req.user.id,name))return fail(res,409,'Репозиторий уже существует.');const id=randomUUID(),path=join(dataDir,'repositories',req.user.id,id);mkdirSync(path,{recursive:true});const git=simpleGit(path);await git.init();await git.addConfig('user.name',req.user.login);await git.addConfig('user.email',req.user.id+'@orbit-git.local');const now=new Date().toISOString(),description=typeof req.body.description==='string'?req.body.description.slice(0,500):'',visibility=req.body.visibility==='public'?'public':'private';db.prepare('INSERT INTO repos(id,owner_id,name,description,visibility,path,created_at) VALUES(?,?,?,?,?,?,?)').run(id,req.user.id,name,description,visibility,path,now);res.status(201).json({id,name,description,visibility,created_at:now})}catch(e){console.error(e);fail(res,500,'Не удалось создать репозиторий.')}});
app.get('/api/repos/:id',auth,(req,res)=>{const r=repoFor(req,res);if(r)res.json({id:r.id,name:r.name,description:r.description,visibility:r.visibility,created_at:r.created_at})});
app.get('/api/repos/:id/files',auth,async(req,res)=>{const r=repoFor(req,res);if(!r)return;try{const s=await gitAt(r).status();res.json({branch:s.current,files:s.files.map(f=>({path:f.path,index:f.index,working_dir:f.working_dir}))})}catch{fail(res,500,'Не удалось прочитать статус Git.')}});
function safePath(root,p){if(typeof p!=='string'||!p||p.startsWith('/')||p.includes('..')||p.includes('\\'))return null;const out=resolve(root,p);return out.startsWith(resolve(root)+'/')?out:null}
app.get('/api/repos/:id/file',auth,async(req,res)=>{const r=repoFor(req,res);if(!r)return;const p=String(req.query.path||''),out=safePath(r.path,p);if(!out)return fail(res,400,'Недопустимый путь.');try{res.json({path:p,content:await readFile(out,'utf8')})}catch{fail(res,404,'Файл не найден.')}});
app.put('/api/repos/:id/file',auth,async(req,res)=>{const r=repoFor(req,res);if(!r)return;const p=req.body?.path,content=req.body?.content,out=safePath(r.path,p);if(!out||typeof content!=='string')return fail(res,400,'Укажи безопасный относительный путь и текст.');if(Buffer.byteLength(content)>512000)return fail(res,413,'Максимальный размер файла — 512 КБ.');try{mkdirSync(resolve(out,'..'),{recursive:true});await writeFile(out,content,'utf8');res.json({ok:true,path:p,bytes:Buffer.byteLength(content)})}catch{fail(res,500,'Не удалось сохранить файл.')}});
app.post('/api/repos/:id/commits',auth,async(req,res)=>{const r=repoFor(req,res);if(!r)return;const message=typeof req.body?.message==='string'?req.body.message.trim().slice(0,200):'';if(!message)return fail(res,400,'Сообщение коммита обязательно.');try{const g=gitAt(r);await g.add('.');const s=await g.status();if(!s.files.length)return fail(res,409,'Нет изменений для коммита.');const c=await g.commit(message);res.status(201).json({ok:true,commit:c.commit,summary:c.summary})}catch{fail(res,500,'Коммит не создан.')}});
app.get('/api/repos/:id/commits',auth,async(req,res)=>{const r=repoFor(req,res);if(!r)return;try{const l=await gitAt(r).log({maxCount:100});res.json({commits:l.all.map(c=>({hash:c.hash,message:c.message,author:c.author_name,date:c.date}))})}catch{res.json({commits:[]})}});
app.get('/auth/github',(_req,res)=>fail(res,503,'GitHub OAuth ещё не настроен. Защищённые маршруты не принимают фиктивную авторизацию.'));
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Внутренняя ошибка сервера.'})});
app.listen(port,host,()=>console.log('Orbit Git API listening on http://'+host+':'+port));
