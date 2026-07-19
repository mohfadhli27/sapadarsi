# Logo Sapabidan (3 mitra)

Ganti file berikut dengan logo resmi. **Jangan copy yarsis-logo ke file lain** — tiap organisasi harus punya gambar sendiri.

| File | Organisasi |
|------|------------|
| `yarsis-logo.png` | Yarsis |
| `unusa-logo.png` | Universitas Nahdlatul Ulama Surabaya |
| `ibi-logo.png` | Ikatan Bidan Indonesia |

Setelah mengganti file, jalankan deploy Sapabidan:

```bash
bash scripts/deploy-sapabidan.sh
pm2 restart sapabidan
```

Logo hanya ditampilkan di **navbar** (bukan hero/footer).
