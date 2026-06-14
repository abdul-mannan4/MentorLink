import {useEffect,useState} from 'react'
import { supabase } from '../../supabase-client'
import { getSignedUrlFromCache, setSignedUrlInCache } from '../../utils/cache'

export function useSignedImage(path:string|null){
    const [url,setUrl]=useState<string>(() => {
        if (path && !path.startsWith("http://") && !path.startsWith("https://")) {
            return getSignedUrlFromCache(path) || "";
        }
        return path || "";
    });

    useEffect(()=>{
        if(!path){
            setUrl("");
            return;
        }

        if (path.startsWith("http://") || path.startsWith("https://")) {
            setUrl(path);
            return;
        }

        const cachedUrl = getSignedUrlFromCache(path);
        if (cachedUrl) {
            setUrl(cachedUrl);
            return;
        }

        let canceled = false;

        const generateUrl=async ()=>{
            const innerCached = getSignedUrlFromCache(path);
            if (innerCached) {
                setUrl(innerCached);
                return;
            }

            const {data,error}=await supabase
            .storage
            .from("profile_image")
            .createSignedUrl(path,3600);
            if (canceled) return;
            if(error)
            {
                console.log(error.message)
                return
            }
            if(data?.signedUrl)
            {
                setSignedUrlInCache(path, data.signedUrl, 3600);
                setUrl(data.signedUrl);
            }
        }
        generateUrl();

        const interval=setInterval(generateUrl,50*60*100)
        return ()=>{ canceled = true; clearInterval(interval) }
        
    },[path]);
    return url
}