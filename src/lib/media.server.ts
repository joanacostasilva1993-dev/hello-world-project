export type MediaProviderId = "pexels" | "pixabay";
export type MediaKind = "image" | "video";

export type MediaAsset = {
  id: string;
  provider: MediaProviderId;
  type: MediaKind;
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

async function searchPexelsImages(query: string, perPage: number): Promise<MediaSearchResult> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return { provider: "pexels", query, assets: [], configured: false };
  const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`, { headers: { Authorization: key } });
  if (!response.ok) throw new Error(`Pexels respondeu ${response.status}.`);
  const data = await response.json() as { photos?: Array<{id:number;alt?:string;width:number;height:number;url:string;photographer?:string;src?:{large?:string}}> };
  return {
    provider:"pexels", query, configured:true,
    assets:(data.photos??[]).map(p=>({
      id:String(p.id),provider:"pexels",type:"image",title:p.alt||"Pexels image",
      url:p.src?.large||p.url,thumbnailUrl:p.src?.large,width:p.width,height:p.height,
      author:p.photographer,sourceUrl:p.url
    }))
  };
}

async function searchPexelsVideos(query: string, perPage: number, orientation?: string): Promise<MediaSearchResult> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return { provider: "pexels", query, assets: [], configured: false };
  const params = new URLSearchParams({ query, per_page: String(perPage) });
  if (orientation === "portrait" || orientation === "landscape" || orientation === "square") params.set("orientation", orientation);
  const response = await fetch(`https://api.pexels.com/v1/videos/search?${params.toString()}`, { headers: { Authorization: key } });
  if (!response.ok) throw new Error(`Pexels respondeu ${response.status}.`);
  const data = await response.json() as {
    videos?: Array<{
      id:number;width:number;height:number;duration?:number;url:string;image?:string;
      user?:{name?:string};video_files?:Array<{link:string;width?:number;height?:number;quality?:string}>
    }>
  };
  return {
    provider:"pexels", query, configured:true,
    assets:(data.videos??[]).map(v=>{
      const files=(v.video_files??[]).filter(f=>f.link).sort((a,b)=>(b.width??0)-(a.width??0));
      const file=files[0];
      return {
        id:String(v.id),provider:"pexels",type:"video",title:"Pexels video",
        url:file?.link||v.url,thumbnailUrl:v.image,width:file?.width||v.width,height:file?.height||v.height,
        duration:v.duration,author:v.user?.name,sourceUrl:v.url
      };
    })
  };
}

async function searchPixabayImages(query: string, perPage: number): Promise<MediaSearchResult> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return { provider: "pixabay", query, assets: [], configured: false };
  const params = new URLSearchParams({ key, q: query, image_type: "photo", per_page: String(perPage), safesearch: "true" });
  const response = await fetch(`https://pixabay.com/api/?${params.toString()}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Pixabay respondeu ${response.status}.`);
  const data = await response.json() as { hits?: Array<{id:number;tags?:string;webformatURL:string;largeImageURL?:string;previewURL?:string;imageWidth?:number;imageHeight?:number;user?:string;pageURL?:string}> };
  return {
    provider:"pixabay", query, configured:true,
    assets:(data.hits??[]).map(p=>({
      id:String(p.id),provider:"pixabay",type:"image",title:p.tags||"Pixabay image",
      url:p.largeImageURL||p.webformatURL,thumbnailUrl:p.previewURL,width:p.imageWidth,height:p.imageHeight,
      author:p.user,sourceUrl:p.pageURL,tags:p.tags?.split(",").map(x=>x.trim())
    }))
  };
}

async function searchPixabayVideos(query: string, perPage: number): Promise<MediaSearchResult> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return { provider: "pixabay", query, assets: [], configured: false };
  const params = new URLSearchParams({ key, q: query, video_type: "all", per_page: String(Math.max(3, perPage)), safesearch: "true", order: "popular" });
  const response = await fetch(`https://pixabay.com/api/videos/?${params.toString()}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Pixabay respondeu ${response.status}.`);
  const data = await response.json() as {
    hits?: Array<{
      id:number;tags?:string;pageURL?:string;duration?:number;user?:string;
      videos?:Record<string,{url?:string;width?:number;height?:number;thumbnail?:string}>
    }>
  };
  return {
    provider:"pixabay", query, configured:true,
    assets:(data.hits??[]).map(p=>{
      const candidates=["large","medium","small","tiny"].map(k=>p.videos?.[k]).filter(v=>v?.url);
      const file=candidates[0];
      return {
        id:String(p.id),provider:"pixabay",type:"video",title:p.tags||"Pixabay video",
        url:file?.url||p.pageURL||"",thumbnailUrl:file?.thumbnail,width:file?.width,height:file?.height,
        duration:p.duration,author:p.user,sourceUrl:p.pageURL,tags:p.tags?.split(",").map(x=>x.trim())
      };
    }).filter(a=>Boolean(a.url))
  };
}

export async function searchMedia(
  query: string,
  providers: MediaProviderId[]=["pexels","pixabay"],
  perPage=8,
  kind: MediaKind="image",
  orientation?: "portrait"|"landscape"|"square"
): Promise<MediaSearchResult[]> {
  const jobs=providers.map(p=>{
    if (kind==="video") return p==="pexels"
      ?searchPexelsVideos(query,perPage,orientation)
      :searchPixabayVideos(query,perPage);
    return p==="pexels"?searchPexelsImages(query,perPage):searchPixabayImages(query,perPage);
  });
  const settled=await Promise.allSettled(jobs);
  return settled.map((r,i)=>r.status==="fulfilled"?r.value:{provider:providers[i],query,assets:[],configured:false});
}
