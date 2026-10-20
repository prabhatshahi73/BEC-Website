CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,role TEXT NOT NULL,name TEXT NOT NULL,company TEXT,phone TEXT,email TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,hash TEXT NOT NULL,at INTEGER);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,uid INTEGER NOT NULL,exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS catalog(id TEXT PRIMARY KEY,name TEXT,d TEXT,p REAL,days INTEGER,q INTEGER);
CREATE TABLE IF NOT EXISTS orders(n INTEGER PRIMARY KEY AUTOINCREMENT,uid INTEGER NOT NULL,items TEXT,st TEXT,sub REAL,total REAL,days INTEGER,at INTEGER,due INTEGER,pay TEXT,rep_name TEXT,rep_data TEXT);
CREATE TABLE IF NOT EXISTS msgs(id INTEGER PRIMARY KEY AUTOINCREMENT,n INTEGER NOT NULL,f TEXT,t TEXT,at INTEGER);
INSERT OR IGNORE INTO catalog VALUES
('s1','EC calculation report','Environmental compensation worked out to CPCB methodology for your unit.',4999,3,0),
('s2','CTO document review','Gap check of your Consent to Operate file, with a list of corrections.',7500,5,0),
('s3','Carbon footprint, Scope 1 and 2','GHG inventory with a reduction roadmap.',24999,10,0),
('s4','CTE or CTO application','Preparation and filing support before the State Pollution Control Board.',0,15,1),
('s5','Environment audit','Site audit of compliance, waste handling and pollution load.',0,20,1),
('s6','ESG and BRSR reporting','Disclosure report aligned to GRI and BRSR.',0,30,1);
