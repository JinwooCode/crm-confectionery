-- Synthetic demo data for the confectionery CRM.
-- Run once: supabase db query --linked -f supabase/seed.sql
-- created_by points to the first admin if one exists (otherwise null).

-- ---------- Products ----------
insert into public.products (name, category, description, price, is_active) values
  ('עוגת שוקולד בלגי', 'עוגות', 'שכבות שוקולד מריר וגנאש קטיפתי', 220, true),
  ('עוגת גבינה פירורים', 'עוגות', 'גבינה 5% על בסיס פריך עם פירורי חמאה', 180, true),
  ('עוגת יום הולדת מעוצבת', 'עוגות מעוצבות', 'עיצוב אישי בבצק סוכר, עד 20 סועדים', 450, true),
  ('עוגת חתונה 3 קומות', 'עוגות מעוצבות', 'שלוש קומות, קרם חמאה ופרחים טריים', 1400, true),
  ('מגש מקרונים (24)', 'קינוחים', 'מקרונים צרפתיים בטעמים מתחלפים', 160, true),
  ('טארט פירות יער', 'טארטים', 'קרם פטיסייר ופירות יער טריים', 150, true),
  ('טארט לימון מרנג', 'טארטים', 'קרם לימון חמצמץ ומרנג שרוף', 140, true),
  ('מגש רוגלך (30)', 'מאפים', 'רוגלך שוקולד וקינמון', 90, true),
  ('קרואסון חמאה', 'מאפים', 'קרואסון צרפתי בחמאה אמיתית', 14, true),
  ('קאפקייקס (12)', 'קינוחים', 'קאפקייקס וניל ושוקולד עם קרם', 120, true),
  ('עוגת גזר', 'עוגות', 'עם אגוזי מלך וציפוי גבינת שמנת', 160, true),
  ('עוגת טירמיסו', 'עוגות', 'מסקרפונה, אספרסו וקקאו', 200, false);

-- ---------- Customers ----------
insert into public.customers (full_name, phone, email, address, notes, created_by)
select c.full_name, c.phone, c.email, c.address, c.notes,
       (select id from public.profiles where role = 'admin' order by created_at limit 1)
from (values
  ('דנה כהן', '050-1234567', 'dana.cohen@example.com', 'הרצל 12, תל אביב', 'אלרגיה לאגוזים'),
  ('יוסי לוי', '052-2345678', 'yossi.levi@example.com', 'ויצמן 5, רחובות', null),
  ('מיכל אברהם', '054-3456789', 'michal.a@example.com', 'הנשיא 30, חיפה', 'מעדיפה פחות מתוק'),
  ('אבי מזרחי', '053-4567890', 'avi.m@example.com', 'רוטשילד 44, ראשון לציון', 'לקוח קבוע – 10% הנחה'),
  ('נועה פרץ', '050-5678901', 'noa.peretz@example.com', 'בן גוריון 8, הרצליה', 'צמחונית'),
  ('רון ביטון', '058-6789012', 'ron.biton@example.com', 'אחד העם 17, פתח תקווה', null),
  ('שירה גולן', '052-7890123', 'shira.golan@example.com', 'הזית 3, מודיעין', 'ללא גלוטן'),
  ('עומר דהן', '054-8901234', 'omer.dahan@example.com', 'השקד 21, כפר סבא', null),
  ('טל שפירא', '050-9012345', 'tal.shapira@example.com', 'ז׳בוטינסקי 60, רמת גן', 'מזמינה לאירועי חברה'),
  ('ליאור אוחיון', '053-0123456', 'lior.o@example.com', 'הגפן 9, נתניה', null),
  ('קפה רוזה (עסקי)', '03-5551234', 'orders@rosa-cafe.example.com', 'דיזנגוף 100, תל אביב', 'הזמנה קבועה כל יום ראשון'),
  ('אולמי הגן', '08-9998877', 'events@hagan.example.com', 'דרך השדות 1, גדרה', 'אירועים – תיאום מראש של שבועיים')
) as c(full_name, phone, email, address, notes);

-- ---------- Orders + items ----------
-- Each row: customer, days from today, status, delivery, notes, items as "product name:qty;..."
with admin as (
  select id from public.profiles where role = 'admin' order by created_at limit 1
),
spec (customer, days, status, delivery, notes, items) as (
  values
    ('דנה כהן', 2, 'new', 'pickup', 'כיתוב: "מזל טוב נועה!" – בלי אגוזים', 'עוגת יום הולדת מעוצבת:1;קאפקייקס (12):1'),
    ('יוסי לוי', 1, 'in_progress', 'delivery', null, 'עוגת שוקולד בלגי:1'),
    ('מיכל אברהם', 3, 'new', 'pickup', null, 'עוגת גבינה פירורים:1;טארט לימון מרנג:1'),
    ('אבי מזרחי', 0, 'ready', 'pickup', 'איסוף ב-17:00', 'מגש רוגלך (30):2;קרואסון חמאה:10'),
    ('נועה פרץ', 5, 'new', 'delivery', null, 'טארט פירות יער:2'),
    ('קפה רוזה (עסקי)', 1, 'in_progress', 'delivery', 'משלוח עד 07:00', 'קרואסון חמאה:40;מגש רוגלך (30):3'),
    ('אולמי הגן', 14, 'new', 'delivery', 'חתונה – 180 איש, פרחים לבנים', 'עוגת חתונה 3 קומות:1;מגש מקרונים (24):5'),
    ('טל שפירא', 4, 'new', 'delivery', 'אירוע חברה', 'קאפקייקס (12):4;מגש מקרונים (24):2'),
    ('שירה גולן', 6, 'new', 'pickup', 'ללא גלוטן!', 'עוגת גזר:1'),
    ('רון ביטון', -2, 'delivered', 'pickup', null, 'עוגת שוקולד בלגי:1;קאפקייקס (12):1'),
    ('דנה כהן', -7, 'delivered', 'delivery', null, 'עוגת גבינה פירורים:2'),
    ('עומר דהן', -4, 'delivered', 'pickup', null, 'טארט לימון מרנג:1;מגש רוגלך (30):1'),
    ('ליאור אוחיון', -1, 'cancelled', 'pickup', 'הלקוח ביטל', 'עוגת יום הולדת מעוצבת:1'),
    ('קפה רוזה (עסקי)', -6, 'delivered', 'delivery', null, 'קרואסון חמאה:40;מגש רוגלך (30):3'),
    ('מיכל אברהם', -10, 'delivered', 'pickup', null, 'מגש מקרונים (24):1')
),
new_orders as (
  insert into public.orders (customer_id, due_date, status, delivery_method, notes, created_by)
  select c.id, current_date + s.days, s.status::public.order_status,
         s.delivery::public.delivery_method, s.notes, (select id from admin)
  from spec s
  join public.customers c on c.full_name = s.customer
  returning id, customer_id, due_date
)
insert into public.order_items (order_id, product_id, quantity, unit_price)
select o.id, p.id, split_part(item, ':', 2)::int, p.price
from new_orders o
join public.customers c on c.id = o.customer_id
join spec s on s.customer = c.full_name and current_date + s.days = o.due_date
cross join lateral unnest(string_to_array(s.items, ';')) as item
join public.products p on p.name = split_part(item, ':', 1);
