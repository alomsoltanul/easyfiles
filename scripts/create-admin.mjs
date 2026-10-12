#!/usr/bin/env node
/**
 * Creates or updates a console account.
 *
 * The console has no sign-up screen and no password-reset email — the first
 * owner has to come from somewhere, and that somewhere is here. After the first
 * owner exists, everyone else is added from Team & access inside the console.
 *
 *   node scripts/create-admin.mjs you@example.com --role owner
 *   node scripts/create-admin.mjs you@example.com --password 'correct horse battery staple'
 *   node scripts/create-admin.mjs you@example.com --google-only
 *
 * With no --password, one is generated and printed once. Reads Supabase
 * credentials from .env.local.
 */

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const ROLES = ['owner', 'admin', 'viewer'];
const MIN_PASSWORD_LENGTH = 12;

function loadEnv(file = '.env.local') {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

function parseArgs(argv) {
  const args = { role: 'admin', googleOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--role') args.role = argv[++i];
    else if (arg === '--password') args.password = argv[++i];
    else if (arg === '--name') args.name = argv[++i];
    else if (arg === '--google-only') args.googleOnly = true;
    else if (!arg.startsWith('--')) args.email = arg;
  }
  return args;
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

async function main() {
  loadEnv();

  const args = parseArgs(process.argv.slice(2));
  const email = (args.email ?? '').trim().toLowerCase();

  if (!email) fail('Usage: node scripts/create-admin.mjs <email> [--role owner|admin|viewer]');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`Not an email address: ${email}`);
  if (!ROLES.includes(args.role)) fail(`Role must be one of: ${ROLES.join(', ')}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  }

  let password = null;
  let generated = false;
  if (!args.googleOnly) {
    password = args.password ?? randomBytes(12).toString('base64url');
    generated = !args.password;
    if (password.length < MIN_PASSWORD_LENGTH) {
      fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const row = {
    email,
    role: args.role,
    name: args.name ?? null,
    password_hash: password ? await bcrypt.hash(password, 12) : null,
    disabled_at: null,
  };

  const { data: existing, error: readError } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (readError) fail(`Could not read admin_users: ${readError.message}`);

  const { error } = existing
    ? await supabase.from('admin_users').update(row).eq('id', existing.id)
    : await supabase.from('admin_users').insert(row);

  if (error) fail(`Could not save the account: ${error.message}`);

  console.log(`\n  ${existing ? 'Updated' : 'Created'} console account`);
  console.log(`  email     ${email}`);
  console.log(`  role      ${args.role}`);
  if (generated) {
    console.log(`  password  ${password}`);
    console.log('\n  This is the only time the password is shown. Change it after signing in.');
  } else if (args.googleOnly) {
    console.log('  password  none — sign in with Google');
  }
  console.log(`\n  Sign in at /${(process.env.ADMIN_PATH_SECRET || 'ops-console-dev').replace(/^\/+|\/+$/g, '')}/login\n`);
}

main().catch((err) => fail(err.message));
