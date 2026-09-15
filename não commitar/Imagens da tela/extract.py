import zipfile

with zipfile.ZipFile('potrace.zip', 'r') as z:
    z.extractall('.')
    print([x.filename for x in z.infolist()])
