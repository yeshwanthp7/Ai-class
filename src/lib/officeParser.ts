import JSZip from "jszip";

/**
 * Extracts text from a DOCX file.
 */
export async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new Error("Invalid DOCX file structure: word/document.xml not found.");
  }
  
  const xmlContent = await documentXmlFile.async("string");
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, "text/xml");
  
  // Extract text from w:t nodes
  const textNodes = doc.getElementsByTagName("w:t");
  const extractedText = Array.from(textNodes)
    .map((node) => node.textContent || "")
    .filter((text) => text.trim().length > 0)
    .join(" ");
    
  return extractedText;
}

/**
 * Extracts text from a PPTX file.
 */
export async function extractPptxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  // PPTX slides are usually located in ppt/slides/slide[Number].xml
  const slideFiles = Object.keys(zip.files).filter((path) =>
    path.startsWith("ppt/slides/slide") && path.endsWith(".xml")
  );
  
  if (slideFiles.length === 0) {
    throw new Error("Invalid PPTX file structure: no slides found.");
  }
  
  // Sort slide files numerically (slide1.xml, slide2.xml, ... slide10.xml) rather than alphabetically
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
    const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
    return numA - numB;
  });
  
  const parser = new DOMParser();
  let fullText = "";
  
  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = zip.file(slideFiles[i]);
    if (slideFile) {
      const xmlContent = await slideFile.async("string");
      const doc = parser.parseFromString(xmlContent, "text/xml");
      
      // Extract text from a:t nodes (PowerPoint text elements)
      const textNodes = doc.getElementsByTagName("a:t");
      const slideText = Array.from(textNodes)
        .map((node) => node.textContent || "")
        .filter((text) => text.trim().length > 0)
        .join(" ");
        
      if (slideText.trim()) {
        fullText += `[Slide ${i + 1}]\n${slideText}\n\n`;
      }
    }
  }
  
  return fullText.trim();
}
