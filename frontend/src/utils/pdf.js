export async function generatePDFBlob(element) {
  // Carga diferida: solo se descarga cuando el usuario necesita el PDF
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    removeContainer: true,
    imageTimeout: 0,
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const imgH = (canvas.height * pageW) / canvas.width
  const imgData = canvas.toDataURL('image/jpeg', 0.92)

  let y = 0
  let heightLeft = imgH
  pdf.addImage(imgData, 'JPEG', 0, y, pageW, imgH)
  heightLeft -= pageH

  while (heightLeft > 0) {
    y -= pageH
    pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, y, pageW, imgH)
    heightLeft -= pageH
  }

  return pdf.output('blob')
}

export async function downloadPDF(element, filename) {
  const blob = await generatePDFBlob(element)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return blob
}
