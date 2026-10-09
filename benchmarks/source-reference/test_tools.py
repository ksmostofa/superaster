"""Small deterministic boundary checks. These fixtures are not model predictions."""
import hashlib,io,json,pathlib,tempfile,unittest
import numpy as np
from prepare import REVISION,download_ranges
from compare import main as compare_main
from unittest.mock import patch

FIXTURE_DIR=pathlib.Path(__file__).resolve().parents[2]/'.cache/general-model-prerequisite/tool-fixtures'
FIXTURE_DIR.mkdir(parents=True,exist_ok=True)

class ComparisonBoundaries(unittest.TestCase):
    def fixture(self,root):
        root.mkdir();(root/'case').mkdir()
        data={'revision':REVISION,'weight_sha256':'same-weight','manifest_sha256':'same-manifest','onnx_artifact_sha256':'explicit-conversion','inference':'completed','cases':[{'id':'case','input_sha256':'same-input'}]}
        (root/'conditions.json').write_text(json.dumps(data))
        for name in ('input','logits','coverage'):np.save(root/'case'/(name+'.npy'),np.ones((1,1,2,2),np.float32),allow_pickle=False)
    def invoke(self,left,right,out):
        with patch('sys.argv',['compare.py','--source',str(left),'--candidate',str(right),'--output',str(out)]):compare_main()
    def test_measures_known_delta_without_awarding_acceptance(self):
        with tempfile.TemporaryDirectory(dir=FIXTURE_DIR) as d:
            r=pathlib.Path(d);a=r/'a';b=r/'b';self.fixture(a);self.fixture(b)
            np.save(b/'case/logits.npy',np.full((1,1,2,2),1.25,np.float32),allow_pickle=False)
            self.invoke(a,b,r/'out.json');report=json.loads((r/'out.json').read_text())
            self.assertEqual(report['results'][0]['arrays']['logits']['max_absolute_difference'],0.25)
            self.assertEqual(report['numerical_acceptance'],'NOT AWARDED')
    def test_different_checkpoint_rejected(self):
        with tempfile.TemporaryDirectory(dir=FIXTURE_DIR) as d:
            r=pathlib.Path(d);a=r/'a';b=r/'b';self.fixture(a);self.fixture(b)
            p=b/'conditions.json';data=json.loads(p.read_text());data['weight_sha256']='other-weight';p.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError,'Different checkpoint'):self.invoke(a,b,r/'out.json')
    def test_different_preprocessing_rejected(self):
        with tempfile.TemporaryDirectory(dir=FIXTURE_DIR) as d:
            r=pathlib.Path(d);a=r/'a';b=r/'b';self.fixture(a);self.fixture(b)
            np.save(b/'case/input.npy',np.zeros((1,1,2,2),np.float32),allow_pickle=False)
            with self.assertRaisesRegex(ValueError,'byte-identical'):self.invoke(a,b,r/'out.json')
    def test_different_input_dtype_rejected(self):
        with tempfile.TemporaryDirectory(dir=FIXTURE_DIR) as d:
            r=pathlib.Path(d);a=r/'a';b=r/'b';self.fixture(a);self.fixture(b)
            np.save(b/'case/input.npy',np.ones((1,1,2,2),np.float16),allow_pickle=False)
            with self.assertRaisesRegex(ValueError,'byte-identical'):self.invoke(a,b,r/'out.json')
    def test_nonfinite_array_rejected(self):
        with tempfile.TemporaryDirectory(dir=FIXTURE_DIR) as d:
            r=pathlib.Path(d);a=r/'a';b=r/'b';self.fixture(a);self.fixture(b)
            np.save(b/'case/logits.npy',np.full((1,1,2,2),np.nan,np.float32),allow_pickle=False)
            with self.assertRaisesRegex(ValueError,'nonfinite'):self.invoke(a,b,r/'out.json')
class RangeBoundaries(unittest.TestCase):
    def response(self,body,content_range,status=206):
        stream=io.BytesIO(body);stream.status=status;stream.headers={'Content-Range':content_range}
        return stream
    def test_exact_ranges_resume_and_verify_complete_hash(self):
        with tempfile.TemporaryDirectory(dir=FIXTURE_DIR) as d:
            part=pathlib.Path(d)/'weight.partial';part.write_bytes(b'ab')
            replies=[self.response(b'cd','bytes 2-3/6'),self.response(b'ef','bytes 4-5/6')]
            with patch('prepare.urllib.request.urlopen',side_effect=replies):
                download_ranges(part,'https://fixture.invalid/weight',6,hashlib.sha256(b'abcdef').hexdigest(),range_bytes=2)
            self.assertEqual(part.read_bytes(),b'abcdef')
            ledger=json.loads(part.with_suffix('.partial.transport.json').read_text())[-1]
            self.assertTrue(ledger['artifact_accepted']);self.assertEqual(len(ledger['ranges']),2)
    def test_wrong_range_never_appended(self):
        with tempfile.TemporaryDirectory(dir=FIXTURE_DIR) as d:
            part=pathlib.Path(d)/'weight.partial';part.write_bytes(b'ab')
            with patch('prepare.urllib.request.urlopen',return_value=self.response(b'cd','bytes 0-1/4')):
                with self.assertRaisesRegex(ValueError,'exact range'):download_ranges(part,'https://fixture.invalid/weight',4,'unused',range_bytes=2)
            self.assertEqual(part.read_bytes(),b'ab')
    def test_short_range_never_appended(self):
        with tempfile.TemporaryDirectory(dir=FIXTURE_DIR) as d:
            part=pathlib.Path(d)/'weight.partial';part.write_bytes(b'ab')
            with patch('prepare.urllib.request.urlopen',return_value=self.response(b'c','bytes 2-3/4')):
                with self.assertRaisesRegex(ValueError,'Incomplete range'):download_ranges(part,'https://fixture.invalid/weight',4,'unused',range_bytes=2)
            self.assertEqual(part.read_bytes(),b'ab')
    def test_complete_hash_mismatch_never_accepted(self):
        with tempfile.TemporaryDirectory(dir=FIXTURE_DIR) as d:
            part=pathlib.Path(d)/'weight.partial';part.write_bytes(b'ab')
            with patch('prepare.urllib.request.urlopen',return_value=self.response(b'cd','bytes 2-3/4')):
                with self.assertRaisesRegex(ValueError,'SHA-256 mismatch'):download_ranges(part,'https://fixture.invalid/weight',4,'wrong',range_bytes=2)
            ledger=json.loads(part.with_suffix('.partial.transport.json').read_text())[-1]
            self.assertFalse(ledger['artifact_accepted'])

if __name__=='__main__':unittest.main()
