# Quick Test Guide - JSON/CSV Ingestion

## 🚀 Quick Start

### 1. Test JSON Ingestion

```bash
npm run ingest json locations.json \
  -t "Sierra Leone Health Facilities" \
  -d "Database of health centers across Sierra Leone" \
  -c "health_facilities"
```

### 2. Test CSV Ingestion

```bash
npm run ingest csv sle_htlfac_grid3_v01_2216453653369958260.csv \
  -t "Health Facilities CSV" \
  -d "CSV format health facilities" \
  -c "health_facilities"
```

## 📊 What to Expect

**JSON Test:**
- Parses 1,617 health facility records
- Converts to markdown format
- Uploads to Geneline-X
- Processing takes 2-5 minutes

**CSV Test:**
- Same data, different source format
- Should produce similar results

## ✅ Verify Success

After ingestion completes, send these WhatsApp messages to the bot:

1. `How many health facilities are there?`
2. `Find facilities in Bo district`
3. `Where is Regent CHC?`
4. `List all hospitals`

## 🔍 Check Job Status

If you used `--no-wait` or need to check later:

```bash
npm run ingest status <job-id>
```

## 📝 Notes

- Make sure `.env` has correct API credentials
- Processing time depends on data size
- Both formats should work identically
- Check logs if errors occur
