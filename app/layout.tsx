import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Wheyland Electric · Material Bot',description:'Internal daily material preparation',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
