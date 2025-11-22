-- Run this to see all columns in the 'leads' table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads';
