# update redshift catalog
cd /data/emerald/emerald
git pull origin main
git add data/redshift-submissions.ndjson
git add ./*.sh
git commit -m "Update redshift submissions"
git push origin main
