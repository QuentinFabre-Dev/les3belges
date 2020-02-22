using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using les3belges;

namespace gestionPriseCommande
{
    public class Livraison
    {
        private int idLivraison;
        private String dateExp;
        private double prix;
        private Expediteur expediteur;
        private Commande commande;


        //Constructeur
        public Livraison(int id, String dateExpedition, double prx, Expediteur unExpediteur,Commande uneCommande)
        {
            idLivraison = id;
            dateExp = dateExpedition;
            prix = prx;
            expediteur = unExpediteur;
            commande = uneCommande;
        }
        public Livraison(int id, String dateExpedition, double prx,Commande uneCommande)
        {
            idLivraison = id;
            dateExp = dateExpedition;
            prix = prx;
            commande = uneCommande;
        }

        //Accesseurs
        public Commande getCommande()
        {return commande;}

        public int getIdLivraison()
        {return idLivraison;}

        public String getDateExp()
        {return dateExp;}

        public double getPrix()
        {return prix;}

        public Expediteur getExpediteur()
        {return expediteur;}
    }
}
