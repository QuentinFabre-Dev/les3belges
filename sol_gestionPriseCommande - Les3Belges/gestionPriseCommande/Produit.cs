using System;

namespace les3belges
{
    public class Produit  
    {
        // Champs
        private string referenceProd;
        private string libelleProduit;
        private double prixUHTProduit;
        private int stockTheorique;
        private double tauxTVA;
        private int stockTemp; //StockTemp = Stock Theorique - Stock Commandé et pas encore envoyé
        private string couleurProduit;
        private string tailleProduit;
        private string origineProduit;
        private int delaiReappro;
        private int seuilReappro;
        private double poids;
        // private Fournisseur leFournisseur;
        //Constructeur #1
        public Produit(string uneRef, string unLibelle, double unPrixUHT, int unStockTheorique, double unTauxTVA, int unStockTemp, string uneCouleur, string uneTaille, string uneOrigine, int unDelai, int unSeuil, double pds)
        {
            referenceProd = uneRef;
            libelleProduit = unLibelle;
            prixUHTProduit = unPrixUHT;
            stockTheorique = unStockTheorique;
            tauxTVA = unTauxTVA;
            stockTemp = unStockTemp;
            couleurProduit = uneCouleur;
            tailleProduit = uneTaille;
            origineProduit = uneOrigine;
            delaiReappro = unDelai;
            seuilReappro = unSeuil;
            poids = pds;
        }
        //Constructeur #2
        public Produit(string uneReference)
        {
            referenceProd = uneReference;
            Produit objProd = this;
            libelleProduit = objProd.getLibelleProduit();
            prixUHTProduit = objProd.getPrixUHTProduit();
            stockTheorique = objProd.getStockTheorique();
            tauxTVA = objProd.getTauxTVA();
            stockTemp = objProd.getStockTemp();
            couleurProduit = objProd.getCouleurProduit();
            tailleProduit = objProd.getTailleProduit();
            origineProduit = objProd.getOrigineProduit();
            delaiReappro = objProd.getDelaiReapro();
            seuilReappro = objProd.getSeuilReapro();
            poids = objProd.getPoids();
        }
        // Méthodes publiques
        public string getReference()
        {
            return referenceProd;
        }
        public string  getLibelleProduit(){
            return libelleProduit;
        }
        public double getPrixUHTProduit()
        {
            return prixUHTProduit;
        }
        public int getStockTheorique()
        {
            return stockTheorique;
        }
        public double getPoids()
        {
            return poids;
        }
         public double getTauxTVA()
        {
            return tauxTVA;
        }
        public int getStockTemp(){
            return stockTemp;
        }
        public string getCouleurProduit()
        {
            return couleurProduit;
        }
        public string getTailleProduit()
        {
            return tailleProduit;
        }
        public string getOrigineProduit(){
            return origineProduit;
        }
        public int getDelaiReapro()
        {
            return delaiReappro;
        }
        public int getSeuilReapro()
        {
            return seuilReappro;
        }
        /// <summary>
        /// diminue le stock temporaire suite à l'enregistrement d'une commande
        /// </summary>
        /// <param name="uneQte">int quantité à enlever</param>
        public void diminuerStockTemp(int uneQte)
        { stockTemp = stockTemp - uneQte; }
    }
}
