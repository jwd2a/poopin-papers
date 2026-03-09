-- Add optional intranet URL for QR code in newsletter footer
alter table public.profiles
  add column intranet_url text;
