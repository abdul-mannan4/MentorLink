import {useEffect,useState} from 'react'
import { supabase } from '../../supabase-client'

export function useSignedImage(path:string|null){
    const [url,setUrl]=useState<string>("");

    useEffect(()=>{
        if(!path)return 

        const generateUrl=async ()=>{
            const {data,error}=await supabase
            .storage
            .from("profile_image")
            .createSignedUrl(path,3600);
        if(error)
        {
            console.log(error.message)
            return
        }
        if(data?.signedUrl)
        {
            setUrl(data.signedUrl);
        }
        } 
        generateUrl();

        const interval=setInterval(generateUrl,50*60*100)
        return ()=>clearInterval(interval)
        
    },[path]);
    return url
}