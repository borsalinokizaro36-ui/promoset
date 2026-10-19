/* Настройки Промосети. Заполните два значения из Supabase:
   Project Settings → API → Project URL и anon public key.
   Ключ anon публичный по замыслу Supabase: данные защищены входом по паролю и правилами доступа в базе. */
window.PROMOSET_CONFIG = {
  supabaseUrl: "https://ВАШ-ПРОЕКТ.supabase.co",
  supabaseKey: "ВАШ-ANON-КЛЮЧ",
  tiles: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">участники OpenStreetMap</a>',
    maxNativeZoom: 19
  }
};
