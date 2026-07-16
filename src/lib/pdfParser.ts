import JSZip from "jszip";

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
  return pages
}

export async function extractPptxPages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const slideFiles = Object.keys(zip.files).filter((path) =>
    path.startsWith("ppt/slides/slide") && path.endsWith(".xml")
  );
  
  if (slideFiles.length === 0) {
    throw new Error("Invalid PPTX file structure: no slides found.");
  }
  
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
    const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
    return numA - numB;
  });
  
  const parser = new DOMParser();
  const pages: string[] = [];
  
  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = zip.file(slideFiles[i]);
    if (slideFile) {
      const xmlContent = await slideFile.async("string");
      const doc = parser.parseFromString(xmlContent, "text/xml");
      
      const textNodes = doc.getElementsByTagName("a:t");
      const slideText = Array.from(textNodes)
        .map((node) => node.textContent || "")
        .filter((text) => text.trim().length > 0)
        .join(" ");
        
      pages.push(slideText.trim() || `[Slide ${i + 1} - Empty Slide]`);
    }
  }
  
  console.log('PPTX slides extracted:', pages.length)
  return pages;
}

export async function extractDocxPages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new Error("Invalid DOCX file structure: word/document.xml not found.");
  }
  
  const xmlContent = await documentXmlFile.async("string");
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, "text/xml");
  
  const paragraphNodes = doc.getElementsByTagName("w:p");
  const paragraphs: string[] = [];
  
  for (let i = 0; i < paragraphNodes.length; i++) {
    const textNodes = paragraphNodes[i].getElementsByTagName("w:t");
    const pText = Array.from(textNodes)
      .map((node) => node.textContent || "")
      .join("")
      .trim();
      
    if (pText) {
      paragraphs.push(pText);
    }
  }
  
  const pages: string[] = [];
  let currentPage = "";
  
  for (const p of paragraphs) {
    if (currentPage.length + p.length > 1000) {
      if (currentPage.trim()) {
        pages.push(currentPage.trim());
      }
      currentPage = p;
    } else {
      currentPage += (currentPage ? "\n\n" : "") + p;
    }
  }
  if (currentPage.trim()) {
    pages.push(currentPage.trim());
  }
  
  console.log('DOCX sections extracted:', pages.length)
  return pages;
}

export async function extractDocumentPages(file: File): Promise<string[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pptx")) {
    return await extractPptxPages(file);
  } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
    return await extractDocxPages(file);
  } else {
    return await extractPDFPages(file);
  }
}
