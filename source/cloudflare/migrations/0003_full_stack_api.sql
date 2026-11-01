-- API state uses one compare-and-swap update; SQLite triggers commit audit,
-- revision history and report projections atomically even on D1 (no interactive transactions).
CREATE TABLE IF NOT EXISTS planner_state (
 id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL CHECK(json_valid(value)), revision INTEGER NOT NULL DEFAULT 1,
 command_id TEXT, command_hash TEXT NOT NULL DEFAULT '', command_kind TEXT NOT NULL DEFAULT 'bootstrap', actor TEXT NOT NULL DEFAULT 'system',
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS command_receipts (
 id TEXT PRIMARY KEY NOT NULL, fingerprint TEXT NOT NULL, revision INTEGER NOT NULL UNIQUE, kind TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS command_receipts_created_at_idx ON command_receipts(created_at);
CREATE TABLE IF NOT EXISTS state_versions (revision INTEGER PRIMARY KEY, value TEXT NOT NULL CHECK(json_valid(value)), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS purchase_records (
 id TEXT PRIMARY KEY NOT NULL, ingredient_key TEXT NOT NULL, name TEXT NOT NULL, qty REAL NOT NULL, unit TEXT NOT NULL,
 paid_minor INTEGER, currency TEXT, shop TEXT, purchased_on TEXT NOT NULL, invoice_id TEXT, created_at TEXT NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS purchase_records_purchased_on_idx ON purchase_records(purchased_on);
CREATE INDEX IF NOT EXISTS purchase_records_invoice_id_idx ON purchase_records(invoice_id);
CREATE TABLE IF NOT EXISTS invoice_records (
 id TEXT PRIMARY KEY NOT NULL, shop TEXT NOT NULL, purchased_on TEXT NOT NULL, total_minor INTEGER, currency TEXT,
 note TEXT NOT NULL, photos TEXT NOT NULL CHECK(json_valid(photos)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS invoice_records_purchased_on_idx ON invoice_records(purchased_on);
CREATE TABLE IF NOT EXISTS meal_records (
 id TEXT PRIMARY KEY NOT NULL, main TEXT NOT NULL, side TEXT NOT NULL, day TEXT NOT NULL, meal_type TEXT NOT NULL,
 servings INTEGER NOT NULL, done INTEGER NOT NULL, minutes INTEGER NOT NULL, cuisine TEXT
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS behavior_events (
 id TEXT PRIMARY KEY NOT NULL, actor TEXT NOT NULL, kind TEXT NOT NULL, view TEXT, created_at TEXT NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS behavior_events_created_at_idx ON behavior_events(created_at);
CREATE INDEX IF NOT EXISTS behavior_events_kind_created_at_idx ON behavior_events(kind,created_at);
CREATE TRIGGER IF NOT EXISTS behavior_events_retention AFTER INSERT ON behavior_events BEGIN
DELETE FROM behavior_events WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-90 days');
DELETE FROM behavior_events WHERE id NOT IN (SELECT id FROM behavior_events ORDER BY created_at DESC LIMIT 5000);
END;
-- Fence legacy whole-document writers as soon as API state exists, including during rollout.
CREATE TRIGGER IF NOT EXISTS planner_legacy_insert BEFORE INSERT ON documents
WHEN NEW.namespace='planner' AND NEW.key='state.json' AND NEW.revision NOT LIKE 'api-%'
AND EXISTS(SELECT 1 FROM planner_state WHERE id='family')
BEGIN SELECT RAISE(ABORT,'api_upgrade_required'); END;
CREATE TRIGGER IF NOT EXISTS planner_legacy_update BEFORE UPDATE ON documents
WHEN NEW.namespace='planner' AND NEW.key='state.json' AND NEW.revision NOT LIKE 'api-%'
AND EXISTS(SELECT 1 FROM planner_state WHERE id='family')
BEGIN SELECT RAISE(ABORT,'api_upgrade_required'); END;
CREATE TRIGGER IF NOT EXISTS planner_legacy_delete BEFORE DELETE ON documents
WHEN OLD.namespace='planner' AND OLD.key='state.json'
AND EXISTS(SELECT 1 FROM planner_state WHERE id='family')
BEGIN SELECT RAISE(ABORT,'api_upgrade_required'); END;
CREATE TRIGGER IF NOT EXISTS planner_state_insert AFTER INSERT ON planner_state BEGIN
DELETE FROM purchase_records WHERE id NOT IN (SELECT json_extract(value,'$.id') FROM json_each(NEW.value,'$.purchaseReceipts'));
INSERT INTO purchase_records (id,ingredient_key,name,qty,unit,paid_minor,currency,shop,purchased_on,invoice_id,created_at) SELECT json_extract(p.value,'$.id'),json_extract(p.value,'$.key'),COALESCE(json_extract(p.value,'$.name'),json_extract(p.value,'$.key')),json_extract(p.value,'$.qty'),json_extract(p.value,'$.unit'),json_extract(p.value,'$.paid.amount'),json_extract(p.value,'$.paid.currency'),json_extract(p.value,'$.shop'),COALESCE(json_extract(p.value,'$.purchasedOn'),substr(json_extract(p.value,'$.at'),1,10)),json_extract(p.value,'$.invoiceId'),json_extract(p.value,'$.at') FROM json_each(NEW.value,'$.purchaseReceipts') p WHERE true ON CONFLICT(id) DO UPDATE SET ingredient_key=excluded.ingredient_key,name=excluded.name,qty=excluded.qty,unit=excluded.unit,paid_minor=excluded.paid_minor,currency=excluded.currency,shop=excluded.shop,purchased_on=excluded.purchased_on,invoice_id=excluded.invoice_id,created_at=excluded.created_at WHERE purchase_records.ingredient_key IS NOT excluded.ingredient_key OR purchase_records.name IS NOT excluded.name OR purchase_records.qty IS NOT excluded.qty OR purchase_records.unit IS NOT excluded.unit OR purchase_records.paid_minor IS NOT excluded.paid_minor OR purchase_records.currency IS NOT excluded.currency OR purchase_records.shop IS NOT excluded.shop OR purchase_records.purchased_on IS NOT excluded.purchased_on OR purchase_records.invoice_id IS NOT excluded.invoice_id OR purchase_records.created_at IS NOT excluded.created_at;
DELETE FROM invoice_records WHERE id NOT IN (SELECT json_extract(value,'$.id') FROM json_each(NEW.value,'$.shoppingInvoices'));
INSERT INTO invoice_records (id,shop,purchased_on,total_minor,currency,note,photos,created_at,updated_at) SELECT json_extract(p.value,'$.id'),json_extract(p.value,'$.shop'),json_extract(p.value,'$.purchasedOn'),json_extract(p.value,'$.total.amount'),json_extract(p.value,'$.total.currency'),json_extract(p.value,'$.note'),json_extract(p.value,'$.photos'),json_extract(p.value,'$.createdAt'),json_extract(p.value,'$.updatedAt') FROM json_each(NEW.value,'$.shoppingInvoices') p WHERE true ON CONFLICT(id) DO UPDATE SET shop=excluded.shop,purchased_on=excluded.purchased_on,total_minor=excluded.total_minor,currency=excluded.currency,note=excluded.note,photos=excluded.photos,created_at=excluded.created_at,updated_at=excluded.updated_at WHERE invoice_records.shop IS NOT excluded.shop OR invoice_records.purchased_on IS NOT excluded.purchased_on OR invoice_records.total_minor IS NOT excluded.total_minor OR invoice_records.currency IS NOT excluded.currency OR invoice_records.note IS NOT excluded.note OR invoice_records.photos IS NOT excluded.photos OR invoice_records.created_at IS NOT excluded.created_at OR invoice_records.updated_at IS NOT excluded.updated_at;
DELETE FROM meal_records WHERE id NOT IN (SELECT json_extract(value,'$.id') FROM json_each(NEW.value,'$.plan.meals'));
INSERT INTO meal_records (id,main,side,day,meal_type,servings,done,minutes,cuisine) SELECT json_extract(p.value,'$.id'),json_extract(p.value,'$.main'),json_extract(p.value,'$.side'),json_extract(p.value,'$.day'),json_extract(p.value,'$.type'),COALESCE(json_extract(NEW.value,'$.mealServings.' || json_quote(json_extract(p.value,'$.id'))),json_extract(NEW.value,'$.servings')),COALESCE(json_extract(NEW.value,'$.progress.done.' || json_quote(json_extract(p.value,'$.id'))),0),json_extract(p.value,'$.minutes'),json_extract(p.value,'$.cuisine') FROM json_each(NEW.value,'$.plan.meals') p WHERE true ON CONFLICT(id) DO UPDATE SET main=excluded.main,side=excluded.side,day=excluded.day,meal_type=excluded.meal_type,servings=excluded.servings,done=excluded.done,minutes=excluded.minutes,cuisine=excluded.cuisine WHERE meal_records.main IS NOT excluded.main OR meal_records.side IS NOT excluded.side OR meal_records.day IS NOT excluded.day OR meal_records.meal_type IS NOT excluded.meal_type OR meal_records.servings IS NOT excluded.servings OR meal_records.done IS NOT excluded.done OR meal_records.minutes IS NOT excluded.minutes OR meal_records.cuisine IS NOT excluded.cuisine;
INSERT INTO documents(namespace,key,value,revision) VALUES('planner','state.json',NEW.value,'api-'||NEW.revision)
ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value,revision=excluded.revision,updated_at=NEW.updated_at;
INSERT INTO command_receipts(id,fingerprint,revision,kind,actor,created_at) SELECT NEW.command_id,NEW.command_hash,NEW.revision,NEW.command_kind,NEW.actor,NEW.updated_at WHERE NEW.command_id IS NOT NULL;
INSERT INTO behavior_events(id,actor,kind,view,created_at) SELECT NEW.command_id,NEW.actor,NEW.command_kind,NULL,NEW.updated_at WHERE NEW.command_id IS NOT NULL;
END;
CREATE TRIGGER IF NOT EXISTS planner_state_update AFTER UPDATE ON planner_state BEGIN
INSERT INTO state_versions(revision,value,created_at) VALUES(OLD.revision,OLD.value,OLD.updated_at);
DELETE FROM state_versions WHERE revision NOT IN (SELECT revision FROM state_versions ORDER BY revision DESC LIMIT 20);
DELETE FROM purchase_records WHERE id NOT IN (SELECT json_extract(value,'$.id') FROM json_each(NEW.value,'$.purchaseReceipts'));
INSERT INTO purchase_records (id,ingredient_key,name,qty,unit,paid_minor,currency,shop,purchased_on,invoice_id,created_at) SELECT json_extract(p.value,'$.id'),json_extract(p.value,'$.key'),COALESCE(json_extract(p.value,'$.name'),json_extract(p.value,'$.key')),json_extract(p.value,'$.qty'),json_extract(p.value,'$.unit'),json_extract(p.value,'$.paid.amount'),json_extract(p.value,'$.paid.currency'),json_extract(p.value,'$.shop'),COALESCE(json_extract(p.value,'$.purchasedOn'),substr(json_extract(p.value,'$.at'),1,10)),json_extract(p.value,'$.invoiceId'),json_extract(p.value,'$.at') FROM json_each(NEW.value,'$.purchaseReceipts') p WHERE true ON CONFLICT(id) DO UPDATE SET ingredient_key=excluded.ingredient_key,name=excluded.name,qty=excluded.qty,unit=excluded.unit,paid_minor=excluded.paid_minor,currency=excluded.currency,shop=excluded.shop,purchased_on=excluded.purchased_on,invoice_id=excluded.invoice_id,created_at=excluded.created_at WHERE purchase_records.ingredient_key IS NOT excluded.ingredient_key OR purchase_records.name IS NOT excluded.name OR purchase_records.qty IS NOT excluded.qty OR purchase_records.unit IS NOT excluded.unit OR purchase_records.paid_minor IS NOT excluded.paid_minor OR purchase_records.currency IS NOT excluded.currency OR purchase_records.shop IS NOT excluded.shop OR purchase_records.purchased_on IS NOT excluded.purchased_on OR purchase_records.invoice_id IS NOT excluded.invoice_id OR purchase_records.created_at IS NOT excluded.created_at;
DELETE FROM invoice_records WHERE id NOT IN (SELECT json_extract(value,'$.id') FROM json_each(NEW.value,'$.shoppingInvoices'));
INSERT INTO invoice_records (id,shop,purchased_on,total_minor,currency,note,photos,created_at,updated_at) SELECT json_extract(p.value,'$.id'),json_extract(p.value,'$.shop'),json_extract(p.value,'$.purchasedOn'),json_extract(p.value,'$.total.amount'),json_extract(p.value,'$.total.currency'),json_extract(p.value,'$.note'),json_extract(p.value,'$.photos'),json_extract(p.value,'$.createdAt'),json_extract(p.value,'$.updatedAt') FROM json_each(NEW.value,'$.shoppingInvoices') p WHERE true ON CONFLICT(id) DO UPDATE SET shop=excluded.shop,purchased_on=excluded.purchased_on,total_minor=excluded.total_minor,currency=excluded.currency,note=excluded.note,photos=excluded.photos,created_at=excluded.created_at,updated_at=excluded.updated_at WHERE invoice_records.shop IS NOT excluded.shop OR invoice_records.purchased_on IS NOT excluded.purchased_on OR invoice_records.total_minor IS NOT excluded.total_minor OR invoice_records.currency IS NOT excluded.currency OR invoice_records.note IS NOT excluded.note OR invoice_records.photos IS NOT excluded.photos OR invoice_records.created_at IS NOT excluded.created_at OR invoice_records.updated_at IS NOT excluded.updated_at;
DELETE FROM meal_records WHERE id NOT IN (SELECT json_extract(value,'$.id') FROM json_each(NEW.value,'$.plan.meals'));
INSERT INTO meal_records (id,main,side,day,meal_type,servings,done,minutes,cuisine) SELECT json_extract(p.value,'$.id'),json_extract(p.value,'$.main'),json_extract(p.value,'$.side'),json_extract(p.value,'$.day'),json_extract(p.value,'$.type'),COALESCE(json_extract(NEW.value,'$.mealServings.' || json_quote(json_extract(p.value,'$.id'))),json_extract(NEW.value,'$.servings')),COALESCE(json_extract(NEW.value,'$.progress.done.' || json_quote(json_extract(p.value,'$.id'))),0),json_extract(p.value,'$.minutes'),json_extract(p.value,'$.cuisine') FROM json_each(NEW.value,'$.plan.meals') p WHERE true ON CONFLICT(id) DO UPDATE SET main=excluded.main,side=excluded.side,day=excluded.day,meal_type=excluded.meal_type,servings=excluded.servings,done=excluded.done,minutes=excluded.minutes,cuisine=excluded.cuisine WHERE meal_records.main IS NOT excluded.main OR meal_records.side IS NOT excluded.side OR meal_records.day IS NOT excluded.day OR meal_records.meal_type IS NOT excluded.meal_type OR meal_records.servings IS NOT excluded.servings OR meal_records.done IS NOT excluded.done OR meal_records.minutes IS NOT excluded.minutes OR meal_records.cuisine IS NOT excluded.cuisine;
INSERT INTO documents(namespace,key,value,revision) VALUES('planner','state.json',NEW.value,'api-'||NEW.revision)
ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value,revision=excluded.revision,updated_at=NEW.updated_at;
INSERT INTO command_receipts(id,fingerprint,revision,kind,actor,created_at) SELECT NEW.command_id,NEW.command_hash,NEW.revision,NEW.command_kind,NEW.actor,NEW.updated_at WHERE NEW.command_id IS NOT NULL;
INSERT INTO behavior_events(id,actor,kind,view,created_at) SELECT NEW.command_id,NEW.actor,NEW.command_kind,NULL,NEW.updated_at WHERE NEW.command_id IS NOT NULL;
END;
INSERT INTO planner_state(id,value,revision,command_id,command_kind,actor) SELECT 'family',value,1,'migration-0003','migration.import','system' FROM documents WHERE namespace='planner' AND key='state.json' ON CONFLICT(id) DO NOTHING;
