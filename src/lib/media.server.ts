export type MediaProviderId = "pexels" | "pixabay";

export type MediaAsset = {
  id: string;
  provider: MediaProviderId;
  type: "image" | "video";
  title: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  author?: string;
  sourceUrl?: string;
  tags?: string[];
};

export type MediaSearchResult = {
  provider: MediaProviderId;
  query: string;
  assets: MediaAsset[];
  configured: boolean;
};

async function searchPexels(query: string, perPage: number): Promise<MediaSearchResult> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return { provider: "pexels", query, assets: [], configured: false };
  const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`, { headers: { Authorization: key } });
  if (!response.ok) throw new Error(`Pexels respondeu ${response.status}.`);
  const data = await response.json() as { photos?: Array<{id:number;alt?:string;width:number;height:number;url:string;photographer?:string;src?:{large?:string}}>};
  return { provider:"pexels", query, configured:true, assets:(data.photos??[]).map(p=>({id:String(p.id),provider:"pexels",type:"image",title:p.alt||"Pexels image",url:p.src?.large||p.url,thumbnailUrl:p.src?.large, width:p.width,height:p.height,author:p.photographer,sourceUrl:p.url})) };
}

async function searchPixabay(query: string, perPage: number): Promise<MediaSearchResult> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return { provider: "pixabay", query, assets: [], configured: false };
  const response = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&image_type=photo&per_page=${perPage}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Pixabay respondeu ${response.status}.`);
  const data = await response.json() as { hits?: Array<{id:number;tags?:string;webformatURL:string;largeImageURL?:string;previewURL?:string;imageWidth?:number;imageHeight?:number;user?:string;pageURL?:string}>};
  return { provider:"pixabay", query, configured:true, assets:(data.hits??[]).map(p=>({id:String(p.id),provider:"pixabay",type:"image",title:p.tags||"Pixabay image",url:p.largeImageURL||p.webformatURL,thumbnailUrl:p.previewURL,width:p.imageWidth,height:p.imageHeight,author:p.user,sourceUrl:p.pageURL,tags:p.tags?.split(",").map(x=>x.trim())})) };
}

export async function searchMedia(query: string, providers: MediaProviderId[]=["pexels","pixabay"], perPage=8): Promise<MediaSearchResult[]> {
  const jobs = providers.map(p=>p==="pexels"?searchPexels(query,perPage):searchPixabay(query,perPage));
  const settled = await Promise.allSettled(jobs);
  return settled.map((r,i)=>r.status==="fulfilled"?r.value:{provider:providers[i],query,assets:[],configured:false});
}
