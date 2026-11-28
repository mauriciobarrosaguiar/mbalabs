"""Accept only the pinned licensed public dataset, never arbitrary user photos."""
import hashlib,json,pathlib,shutil,sys
MANIFEST=pathlib.Path(__file__).with_name("public-fixture.json")
def verify(root, dest=None):
    root=pathlib.Path(root)
    items=json.loads(MANIFEST.read_text())["images"]
    if len(items)!=29 or {p.name for p in root.iterdir()}!={i["name"] for i in items}:
        raise ValueError("unexpected fixture files")
    for i in items:
        p=root/i["name"]
        if p.is_symlink() or not p.is_file() or p.stat().st_size!=i["bytes"]:
            raise ValueError("fixture size or type mismatch")
        b=p.read_bytes()
        if hashlib.sha1(f"blob {len(b)}\0".encode()+b).hexdigest()!=i["gitSha"]:
            raise ValueError("fixture digest mismatch")
    if dest is not None:
        for i in items: shutil.copyfile(root/i["name"],pathlib.Path(dest)/i["name"])
    return items
if __name__=="__main__":
    verify(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else None)
