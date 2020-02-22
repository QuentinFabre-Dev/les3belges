using System;

namespace les3belges
{
    public class Client
    {
        // propriétées privées de la classe:
        private int numClient;
        private string nomClient;
        private string prenomClient;
        private string adresseClient;
        private string cpClient;
        private string villeClient;
        private string emailClient; // dommage qu'il ne soit pas dans la bdd !!!!!!
        private string telClient;
        // constructeur de classe client si il existe dans la DB :
        public Client(int unNumClient)
        {
            numClient = unNumClient;
            // et on fait rien ???? ne sert à rien
        }
        // constructeur de classe client si il n'existe pas dans la DB :
        public Client(int unNumClient, string unNomClient, string unPrenomClient, string uneAdresseClient, string unCpClient, string uneVilleClient, string unTelClient, string unEmailClient)
        {
            numClient = unNumClient;
            nomClient = unNomClient;
            prenomClient = unPrenomClient;
            adresseClient = uneAdresseClient;
            cpClient = unCpClient;
            villeClient = uneVilleClient;
            emailClient = unEmailClient;
            telClient = unTelClient;
        }
        public int getNumClient()
        {
            return numClient;
        }
        public string getNomClient()
        {
            return nomClient;
        }
        public string getPrenomClient()
        {
            return prenomClient;
        }
        public string getAdresseClient()
        {
            return adresseClient;
        }
        public string getCpClient()
        { if (cpClient.Length == 4)
            { cpClient = "0" + cpClient; }
            return cpClient;
        }
        public string getVilleClient()
        {
            return villeClient;
        }
        public string getTelClient()
        {
            if (telClient.Length == 9)
            { cpClient = "0" + cpClient; }
            return telClient;
        }
        public string getEmailClient()
        {
            return emailClient;
        }
        public void enregistrerClient(Client unClient)
        {
            //Passerelle.enregistrerClient(unClient);
        }   //    !! quelle horreur !!!!
    }
}
