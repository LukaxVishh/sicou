"""External-client document processing and import contract, on the disposable HTTP fixture."""
import io
import zipfile


def archive(parts):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w') as z:
        for name, content in parts.items():
            z.writestr(name, content)
    return stream.getvalue()


def fixtures():
    types = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>{}</Types>'
    rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="{}"/></Relationships>'
    docx = archive({'[Content_Types].xml': types.format('<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'), '_rels/.rels': rels.format('word/document.xml'), 'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>TCC integration document</w:t></w:r></w:p></w:body></w:document>'})
    xlsx = archive({'[Content_Types].xml': types.format('<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'), '_rels/.rels': rels.format('xl/workbook.xml'), 'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Test" sheetId="1" r:id="rId1"/></sheets></workbook>', 'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>', 'xl/worksheets/sheet1.xml': '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>TCC integration sheet</t></is></c></row></sheetData></worksheet>'})
    content = b'BT /F1 12 Tf 50 700 Td (TCC integration PDF) Tj ET'
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>', b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', f'<< /Length {len(content)} >>\nstream\n'.encode() + content + b'\nendstream']
    pdf = b'%PDF-1.4\n'; offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(pdf)); pdf += f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n'
    start = len(pdf)
    pdf += b'xref\n0 6\n0000000000 65535 f \n' + b''.join(f'{n:010} 00000 n \n'.encode() for n in offsets[1:])
    pdf += f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF'.encode()
    return [('sample.csv', b'name,value\nTCC integration CSV,1\n'), ('sample.docx', docx), ('sample.xlsx', xlsx), ('sample.pdf', pdf)]


def run_documents(request, check, mint, company):
    token = mint(['documents:process'])['token']
    readonly = mint(['imports:read'])['token']
    writer = mint(['imports:write'])['token']
    status, doc, _ = request('GET', '/swagger/integrations/swagger.json')
    check(status == 200 and all(p in doc['paths'] for p in ['/api/documents/process', '/api/imports/options', '/api/imports/{kind}/preview', '/api/imports/confirm']), 'Swagger documents external document and import contracts')
    for filename, content in fixtures():
        status, result, _ = request('POST', '/api/documents/process', token, {'file': (filename, content)}, form=True)
        check(status == 200 and (result['text'] or result['tables']), 'external token processes ' + filename)
    check(request('POST', '/api/documents/process', readonly, {'file': ('sample.csv', b'a,b\n1,2')}, form=True)[0] == 403, 'import reader cannot process documents')
    check(request('GET', '/api/imports/options', token)[0] == 403, 'document scope cannot access imports')
    check(request('GET', '/api/imports/options', readonly)[0] == 200, 'import options allowed by explicit scope')
    body = {'companyId': company, 'file': ('units.csv', b'nome;codigo;cidade;uf\nUnidade API TCC;API-TCC;Sao Paulo;SP\n')}
    check(request('POST', '/api/imports/units/preview', readonly, body, form=True)[0] == 403, 'read-only scope cannot preview import')
    status, preview, _ = request('POST', '/api/imports/units/preview', writer, body, form=True)
    check(status == 200 and preview['token'], 'external client validates unit import')
    check(request('POST', '/api/imports/confirm', writer, {'token': preview['token']})[0] == 200, 'external client confirms validated import')
    check(request('POST', '/api/imports/confirm', writer, {'token': preview['token']})[0] == 400, 'import confirmation is single use')
