#!/usr/bin/env bash
# CI smoke test; only public fixture, no production credentials or paid resources.
set -Eeuo pipefail
trap 'echo "::error::Failure at line $LINENO (exit $?)"' ERR
command -v gdalinfo
command -v gdal_translate
gdalinfo --version
cd "$(dirname "$0")"
work="$(mktemp -d)"
container="geomap-ci-$$"
cleanup() {
  docker logs --tail 80 "$container" 2>/dev/null || true
  docker rm -fv "$container" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
git clone --quiet https://github.com/merkato/odm_mygla_dataset.git "$work/fixture"
git -C "$work/fixture" checkout --quiet cf0ef2f1dd779c04fc0d55324692c60fe6cc7597
mapfile -d '' images < <(find "$work/fixture/images" -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) -print0 | sort -z)
[[ "${#images[@]}" -eq 29 ]]
docker pull "${NODEODM_IMAGE:-opendronemap/nodeodm@sha256:fcd99eb23d8db194a7d1dc95f029f518283b3d6be32dd64422395f4e7af56720}"
docker image inspect "${NODEODM_IMAGE:-opendronemap/nodeodm@sha256:fcd99eb23d8db194a7d1dc95f029f518283b3d6be32dd64422395f4e7af56720}" --format '{{json .RepoDigests}}'
docker run -d --name "$container" -p 127.0.0.1:3000:3000 "${NODEODM_IMAGE:-opendronemap/nodeodm@sha256:fcd99eb23d8db194a7d1dc95f029f518283b3d6be32dd64422395f4e7af56720}"
base=http://127.0.0.1:3000
for i in {1..60}; do
  if curl -fsS --max-time 5 "$base/info" > "$work/info.json"; then break; fi
  sleep 5
done
jq -e 'type == "object" and (has("error") | not)' "$work/info.json"
curl -fsS "$base/options" > "$work/options.json"
jq -e 'type == "array" and length > 0' "$work/options.json" >/dev/null
args=()
for img in "${images[@]}"; do args+=(-F "images=@$img"); done
uuid="$(curl -fsS --max-time 300 -F 'name=geomap-public-mygla' -F 'options=[{"name":"dsm","value":true},{"name":"dtm","value":true},{"name":"max-concurrency","value":2},{"name":"pc-quality","value":"low"},{"name":"orthophoto-resolution","value":5}]' "${args[@]}" "$base/task/new" | jq -er '.uuid | select(type == "string" and length > 0)')"
echo "Task: $uuid"
start=$SECONDS
while true; do
  curl -fsS --max-time 30 "$base/task/$uuid/info" > "$work/status.json"
  jq '{status,progress,processingTime,imagesCount}' "$work/status.json"
  state="$(jq -er '.status.code' "$work/status.json")"
  case "$state" in
    40) break ;;
    30|50) curl -fsS "$base/task/$uuid/output" || true; exit 1 ;;
    10|20) ;;
    *) echo "Unknown state: $state"; exit 1 ;;
  esac
  if (( SECONDS - start > 4800 )); then echo "Timeout"; exit 1; fi
  sleep 30
done
curl -fsS --max-time 300 "$base/task/$uuid/download/all.zip" -o "$work/result.zip"
python3 - "$work/result.zip" "$work" <<'PY'
import sys, zipfile, pathlib, shutil
with zipfile.ZipFile(sys.argv[1]) as z:
    assert z.testzip() is None, "Invalid ZIP"
    names = z.namelist()
    for filename in ("odm_orthophoto.tif", "dsm.tif", "dtm.tif"):
        matches = [n for n in names if n.split("/")[-1] == filename]
        assert len(matches) == 1, f"Expected exactly one {filename}, got {matches}"
        with z.open(matches[0]) as f:
            assert f.read(4) in (b"II*\x00", b"MM\x00*", b"II+\x00", b"MM\x00+"), filename
        with z.open(matches[0]) as source, (pathlib.Path(sys.argv[2]) / filename).open("wb") as target:
            shutil.copyfileobj(source, target)
        print(filename, z.getinfo(matches[0]).file_size, "bytes")
    print("Archive and TIFF signatures verified; CRS and visual quality still require validation.")
PY
echo "Elapsed seconds: $((SECONDS-start))"
df -h .

# Public fixture only: export verified outputs for review after runner shutdown.
out="${RUNNER_TEMP:?CI runner temp required}/geomap-public-result"
mkdir -p "$out"
for product in odm_orthophoto/odm_orthophoto.tif odm_dem/dsm.tif odm_dem/dtm.tif; do
  name="$(basename "$product" .tif)"
  gdalinfo -json "$work/$name.tif" > "$out/$name.json"
  jq -e '.size[0] > 0 and .size[1] > 0 and (.coordinateSystem.wkt | type == "string" and length > 0) and (.geoTransform | length == 6) and (.bands | length > 0)' "$out/$name.json" >/dev/null
done
gdal_translate -of PNG -outsize 1200 0 "$work/odm_orthophoto.tif" "$out/ortomosaico-preview.png"
test -s "$out/ortomosaico-preview.png"
cp "$work/result.zip" "$out/all.zip"
cp "$work/info.json" "$work/status.json" "$out/"
printf '%s\n' 'Mygla dataset — aerial photos by Tomasz Nycz (CC BY 3.0).' 'Source: https://github.com/merkato/odm_mygla_dataset/tree/cf0ef2f1dd779c04fc0d55324692c60fe6cc7597' 'License: https://creativecommons.org/licenses/by/3.0/' 'Derived outputs: GeoMap test using OpenDroneMap; photogrammetric reconstruction and resized PNG preview.' > "$out/ATTRIBUTION.txt"
(cd "$out" && sha256sum all.zip ortomosaico-preview.png > SHA256SUMS)
