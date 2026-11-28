#!/usr/bin/env python3
"""One-shot public R2 → NodeODM → R2 integration on a dedicated Linux worker.
Never run in public CI with real credentials. No arbitrary uploads or keys.
"""
import datetime,hashlib,json,os,pathlib,re,subprocess,tempfile,uuid,sys
from importlib.machinery import SourceFileLoader
HERE=pathlib.Path(__file__).resolve().parent
verify=SourceFileLoader("verify_public",str(HERE/"verify-public-fixture.py")).load_module().verify
BUCKET="mba-geomap"
CAP=8_000_000_000
MAX_RESULTS=500_000_000
def run():
    if os.getenv("GEOMAP_PUBLIC_WORKER_ENABLE")!="yes": raise RuntimeError("Explicit public worker opt-in required")
    endpoint=os.environ["R2_ENDPOINT"].rstrip("/")
    if not re.fullmatch(r"https://[0-9a-f]{32}\.r2\.cloudflarestorage\.com",endpoint): raise ValueError("R2 endpoint")
    if os.getenv("R2_BUCKET_NAME")!=BUCKET: raise ValueError("Bucket")
    if os.getenv("GITHUB_ACTIONS"): raise RuntimeError("Real R2 worker forbidden in GitHub Actions")
    env={**os.environ,"AWS_ACCESS_KEY_ID":os.environ["R2_ACCESS_KEY_ID"],"AWS_SECRET_ACCESS_KEY":os.environ["R2_SECRET_ACCESS_KEY"],"AWS_DEFAULT_REGION":"auto","AWS_EC2_METADATA_DISABLED":"true","AWS_PAGER":""}
    env.pop("AWS_SESSION_TOKEN",None)
    def s3(*args, allow_failure=False):
        p=subprocess.run(["aws","--endpoint-url",endpoint,"--region","auto","--no-cli-pager","s3api",*args],env=env,capture_output=True,timeout=180)
        if p.returncode and not allow_failure: raise RuntimeError("S3 operation failed: "+args[0])
        return p
    def listing():
        o=json.loads(s3("list-objects-v2","--bucket",BUCKET,"--max-keys","1000","--no-paginate").stdout)
        if o.get("IsTruncated") is not False: raise RuntimeError("Incomplete inventory: refusing write")
        return sum(x["Size"] for x in o.get("Contents",[]))
    prefix="__geomap_public_worker/"+str(uuid.uuid4())+"/"
    keys=[]
    def transfer(path,key,target):
        keys.append(key)
        s3("put-object","--bucket",BUCKET,"--key",key,"--body",str(path))
        s3("get-object","--bucket",BUCKET,"--key",key,str(target))
        def sha(p):
            with p.open("rb") as stream:return hashlib.file_digest(stream,"sha256").hexdigest()
        if sha(path)!=sha(target): raise RuntimeError("R2 integrity mismatch")
    with tempfile.TemporaryDirectory(prefix="geomap-public-") as tmp:
        root=pathlib.Path(tmp)
        subprocess.run(["git","clone","--quiet","https://github.com/merkato/odm_mygla_dataset.git",str(root/"source")],check=True,timeout=300)
        subprocess.run(["git","-C",str(root/"source"),"checkout","--quiet","cf0ef2f1dd779c04fc0d55324692c60fe6cc7597"],check=True,timeout=60)
        src=root/"source"/"images";items=verify(src)
        if listing()+sum(i["bytes"] for i in items)+MAX_RESULTS>CAP: raise RuntimeError("Preventive storage allowance exceeded")
        received=root/"received";received.mkdir()
        try:
            for i in items: transfer(src/i["name"],prefix+"inputs/"+i["name"],received/i["name"])
            verify(received)
            # No R2 secrets are passed to the processing container/child.
            clean={k:v for k,v in os.environ.items() if not k.startswith(("R2_","AWS_","GEOMAP_"))}
            clean.update(RUNNER_TEMP=str(root),GEOMAP_PUBLIC_FIXTURE_DIR=str(received))
            subprocess.run(["bash",str(HERE/"ci-smoke.sh")],env=clean,check=True,timeout=6000)
            out=root/"geomap-public-result";files=[p for p in out.iterdir() if p.is_file() and not p.is_symlink()]
            total=sum(p.stat().st_size for p in files)
            if total>MAX_RESULTS or listing()+total>CAP: raise RuntimeError("Output storage allowance exceeded")
            confirmed=root/"confirmed";confirmed.mkdir()
            for p in files: transfer(p,prefix+"results/"+p.name,confirmed/p.name)
            print(json.dumps({"publicFixture":True,"photos":len(items),"outputFiles":len(files),"bytes":total,"verified":True}),flush=True)
        finally:
            failed=False
            for key in reversed(keys):
                try:
                    deleted=s3("delete-object","--bucket",BUCKET,"--key",key)
                    # Confirm absence through listing, not an ambiguous HEAD error.
                    check=json.loads(s3("list-objects-v2","--bucket",BUCKET,"--prefix",key,"--max-keys","1","--no-paginate").stdout)
                    if check.get("KeyCount")!=0: failed=True
                except Exception: failed=True
            if failed: raise RuntimeError("Cleanup incomplete; inspect worker prefix in private R2 dashboard")
            print("Public test objects removed and absence verified.",flush=True)
if __name__=="__main__":
    run()
