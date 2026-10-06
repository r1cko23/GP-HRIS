-- SIL monthly run pay method per client.
-- Casual/on-call is days/26 × 5/12. Full 313 is days/313 × 5, paid on anniversary.
-- Clients not listed stay null and the run keeps the casual formula.

ALTER TABLE directory.clients
  ADD COLUMN IF NOT EXISTS sil_pay_method TEXT;

ALTER TABLE directory.clients
  DROP CONSTRAINT IF EXISTS clients_sil_pay_method_check;

ALTER TABLE directory.clients
  ADD CONSTRAINT clients_sil_pay_method_check
  CHECK (
    sil_pay_method IS NULL
    OR sil_pay_method IN ('casual_prorated', 'full_313_anniversary')
  );

COMMENT ON COLUMN directory.clients.sil_pay_method IS
  'SIL monthly run: casual_prorated (days/26 × 5/12) or full_313_anniversary (days/313 × 5 on hire anniversary).';

UPDATE directory.clients
SET sil_pay_method = 'casual_prorated'
WHERE name IN (
  'Deluxe Hotels And Recreation Inc-Manila Hilton Hotel',
  'Melco Resorts Leisure (Php) Corp- City Of Dreams',
  'Pico De Loro Beach And Country Club Inc.',
  'Rockwell Hotel & Leisure Management Corp-Aruga By Rockwell',
  'Sm Prime Holdings Inc-Taal Vistal Hotel',
  'Sm Prime Holdings Inc.-Conrad Hotel',
  'Sm Prime Holdings Inc.-Lanson Place',
  'Sm Prime Holdings Inc.-Pico De Loro',
  'Sm Prime Holdings Inc.-Smxcc',
  'Tiger Resort Leisure And Entertainment Inc-Okada Manila'
);

UPDATE directory.clients
SET sil_pay_method = 'full_313_anniversary'
WHERE name IN (
  'Aldex Realty Corporation',
  'Berjaya Paris Baguette Phils Inc.',
  'Chicha Hut Food Corp.',
  'Comclark Network & Technology Info. Corp.',
  'Converge Info And Communications Tech Solutions Inc',
  'Epicurean Partners Exchange Inc',
  'Goldilocks Bakeshop Inc.',
  'Nikkei Global City Inc.',
  'Plk Phils. Inc',
  'Sm Development Corporation',
  'Teishoku Dining Concepts Inc.',
  'Teppanya Restuarant Alabang Inc',
  'Vouno Trade & Marketing Services, Corp.'
);

NOTIFY pgrst, 'reload schema';
