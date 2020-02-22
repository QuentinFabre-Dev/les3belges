using System;

namespace les3belges
{
    public class LigneCommandeClient  
    {
        // proprietes privées de la classe lignecommandeclient
        private int quantiteProduit;
        private Produit leProduit;
        private Commande laCommande;

        //constructeur de le classe lignecommandeclient
        public LigneCommandeClient(int uneQuantiteProduit, Commande uneCommande,Produit unProduit)
        {
            quantiteProduit = uneQuantiteProduit;
            leProduit = unProduit;
            laCommande = uneCommande;
        }
        public int getLaQuantité(){
            return quantiteProduit;
        }
        public Produit getLeProduit(){
            return leProduit;
        }
        public Commande getLaCommande(){
            return laCommande;
        }



    }
}
