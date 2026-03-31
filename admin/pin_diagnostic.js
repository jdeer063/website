
// Diagnostic script to check current PIN in database
async function checkCurrentPIN() {
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('*');
        if (error) {
            console.error('Error fetching settings:', error);
            return;
        }
        console.log('Current System Settings:', data);
    } catch (err) {
        console.error('Diagnostic failed:', err);
    }
}
checkCurrentPIN();
