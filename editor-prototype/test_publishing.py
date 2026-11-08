import unittest, json
from copy import deepcopy
from publishing import publish_entry,catalogue,migrate_folios

def entry(id='041'):
 return {'schemaVersion':2,'entryId':id,'title':'A public thought','description':'A short description','type':'Essay','originalDate':'2026-11-06','connected':['040'],'dirty':True,'privateMetadata':'PRIVATE','body':{'type':'doc','attrs':{'annotations':{'orphan':{'id':'orphan','kind':'side','text':'PRIVATE ORPHAN'},'side':{'id':'side','kind':'side','text':'An attached note'}}},'content':[{'type':'paragraph','attrs':{'blockId':'p1','annotations':['side']},'content':[{'type':'text','text':'Words for the page.'}]}]}}
class PublishingTest(unittest.TestCase):
 def test_demos_and_drafts_are_not_public(self):
  e=entry();e['published']=deepcopy(e)
  self.assertEqual(catalogue({'entries':[e]})['entries'],[])
 def test_publish_excludes_private_fields_orphans_and_unpublished_connections(self):
  original={'entries':[entry(),entry('040')]};book,published,changed=publish_entry(original,'041',at='2026-11-06T12:00:00Z');self.assertTrue(changed);self.assertNotIn('publication',original['entries'][0])
  public=catalogue(book);self.assertEqual(len(public['entries']),1);self.assertNotIn('PRIVATE',json.dumps(public));self.assertEqual(public['entries'][0]['connected'],[]);self.assertEqual(public['entries'][0]['body']['attrs']['annotations']['side']['text'],'An attached note')
 def test_drafts_stay_private_until_update_and_unchanged_publish_is_idempotent(self):
  book,e,_=publish_entry({'entries':[entry()]},'041',at='2026-11-06T12:00:00Z');book['entries'][0]['title']='New draft';self.assertEqual(catalogue(book)['entries'][0]['title'],'A public thought')
  book,e,_=publish_entry(book,'041',at='2026-11-07T12:00:00Z');self.assertEqual(e['publication']['version'],2);self.assertEqual(catalogue(book)['entries'][0]['title'],'New draft')
  same,e,changed=publish_entry(book,'041');self.assertFalse(changed);self.assertEqual(e['publication']['version'],2)
 def test_connections_follow_published_catalogue_and_unpublish_does_not_delete_draft(self):
  book,e,_=publish_entry({'entries':[entry(),entry('040')]},'041');book,e,_=publish_entry(book,'040');self.assertEqual(catalogue(book)['entries'][0]['connected'],['040'])
  book,e,_=publish_entry(book,'040','unpublish');self.assertEqual(len(book['entries']),2);self.assertEqual(len(catalogue(book)['entries']),1);self.assertEqual(catalogue(book)['entries'][0]['connected'],[])
  book,e,_=publish_entry(book,'040');self.assertEqual(e['publication']['version'],2);self.assertEqual(e['publication']['events'][-1]['kind'],'republish')
 def test_invalid_publish_keeps_previous_version(self):
  book={'entries':[entry()]};book['entries'][0]['title']='  '
  with self.assertRaises(ValueError):publish_entry(book,'041')
  self.assertNotIn('publication',book['entries'][0])
class FolioTest(unittest.TestCase):
 def test_independent_sequences_and_drafts_do_not_consume_numbers(self):
  book={'entries':[entry(str(i)) for i in range(1,6)]}
  book['entries'][1]['type']='Note';book['entries'][3]['type']='Sketch'
  expected=[('1',1),('2',1),('3',2),('4',1)]
  for id,number in expected:
   book,published,_=publish_entry(book,id);self.assertEqual(published['published']['folioNumber'],number)
  self.assertNotIn('folioNumber',book['entries'][4])
  book,_,_=publish_entry(book,'1','unpublish');book,published,_=publish_entry(book,'5');self.assertEqual(published['published']['folioNumber'],3)
 def test_updates_and_republication_keep_number_and_stable_id(self):
  book,e,_=publish_entry({'entries':[entry()]},'041');book['entries'][0]['title']='Updated';book,e,_=publish_entry(book,'041');self.assertEqual(e['published']['folioNumber'],1)
  book,e,_=publish_entry(book,'041','unpublish');book,e,_=publish_entry(book,'041');self.assertEqual(e['published']['folioNumber'],1);self.assertEqual(e['entryId'],'041')
 def test_type_changes_allocate_from_new_category_and_keep_old_reservation(self):
  book,e,_=publish_entry({'entries':[entry('041'),entry('042')]},'041');book['entries'][0]['type']='Note';book,e,_=publish_entry(book,'041');self.assertEqual(e['published']['folioNumber'],1);self.assertEqual(e['folioNumbers'],{'Essay':1,'Note':1})
  book,e,_=publish_entry(book,'042');self.assertEqual(e['published']['folioNumber'],2)
  book['entries'][0]['type']='Essay';book,e,_=publish_entry(book,'041');self.assertEqual(e['published']['folioNumber'],1)
 def test_migration_is_idempotent_and_preserves_contents_links_and_history(self):
  book={'entries':[entry('041'),entry('042'),entry('043')]};book['entries'][1]['type']='Note'
  for id in ['041','042','043']:book,_,_=publish_entry(book,id)
  for e in book['entries']:
   for field in ['folioNumbers','folioNumber','folioType']:e.pop(field,None)
   e['published'].pop('folioNumber',None)
  before=deepcopy(book);migrated,changed=migrate_folios(book);self.assertTrue(changed)
  for old,new in zip(before['entries'],migrated['entries']):
   for field in ['entryId','title','body','connected','publication']:self.assertEqual(old[field],new[field])
   self.assertEqual(old['published']['body'],new['published']['body'])
  self.assertEqual([e['published']['folioNumber'] for e in migrated['entries']],[1,1,2])
  same,changed=migrate_folios(migrated);self.assertFalse(changed);self.assertEqual(same,migrated)
if __name__=='__main__':unittest.main()
