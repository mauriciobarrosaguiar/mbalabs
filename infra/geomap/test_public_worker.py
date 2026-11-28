import hashlib,importlib.util,json,os,pathlib,tempfile,unittest
from unittest.mock import patch
HERE=pathlib.Path(__file__).resolve().parent
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,HERE/file)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
verify=load("fixture_verification","verify-public-fixture.py")
worker=load("worker_under_test","public-r2-worker.py")
class PublicWorkerTests(unittest.TestCase):
    def test_pinned_manifest(self):
        m=json.loads((HERE/"public-fixture.json").read_text())
        self.assertEqual(len(m["images"]),29)
        self.assertEqual(sum(i["bytes"] for i in m["images"]),155493827)
    def test_fixture_verifier_rejects_changed_or_extra_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp);source=root/"source";source.mkdir();dest=root/"dest";dest.mkdir()
            items=[]
            for n in range(29):
                name=f"sample{n}.jpg";b=f"synthetic fixture {n}".encode();(source/name).write_bytes(b)
                items.append({"name":name,"bytes":len(b),"gitSha":hashlib.sha1(f"blob {len(b)}\0".encode()+b).hexdigest()})
            manifest=root/"manifest.json";manifest.write_text(json.dumps({"images":items}))
            with patch.object(verify,"MANIFEST",manifest):
                self.assertEqual(len(verify.verify(source,dest)),29)
                self.assertEqual((dest/"sample1.jpg").read_bytes(),(source/"sample1.jpg").read_bytes())
                p=source/"sample1.jpg";b=p.read_bytes();p.write_bytes(b"X"+b[1:])
                with self.assertRaises(ValueError):verify.verify(source)
                p.write_bytes(b);(source/"extra.jpg").write_bytes(b)
                with self.assertRaises(ValueError):verify.verify(source)
    def test_worker_refuses_missing_optin_or_public_ci(self):
        with patch.dict(os.environ,{},clear=True):
            with self.assertRaisesRegex(RuntimeError,"opt-in"):worker.run()
        with patch.dict(os.environ,{"GEOMAP_PUBLIC_WORKER_ENABLE":"yes","R2_ENDPOINT":"https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com","R2_BUCKET_NAME":"mba-geomap","GITHUB_ACTIONS":"true"},clear=True):
            with self.assertRaisesRegex(RuntimeError,"forbidden"):worker.run()
