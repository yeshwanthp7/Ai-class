export async function extractPDFPages(file: File): Promise<string[]> {
  // Dynamically import pdfjs-dist so it only loads in the browser, avoiding SSR issues
  const pdfjsLib = await import('pdfjs-dist')
  
  // Set worker source to the public CDN url
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const text = textContent.items
      .map((item: any) => item.str)
      .join(' ')
    pages.push(text)
  }
  
  console.log('PDF pages extracted:', pages.length)
  console.log('Page 1 content:', pages[0]?.slice(0, 500))
  
  return pages
}
