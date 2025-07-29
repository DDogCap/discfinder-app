-- Enable RLS on t_faq table
ALTER TABLE public.t_faq ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to read FAQs
CREATE POLICY "Allow public read access to FAQs" ON public.t_faq
    FOR SELECT
    USING (true);

-- Create policy to allow only admins to insert/update/delete FAQs
CREATE POLICY "Allow admin full access to FAQs" ON public.t_faq
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Grant necessary permissions
GRANT SELECT ON public.t_faq TO anon, authenticated;
GRANT ALL ON public.t_faq TO authenticated;
