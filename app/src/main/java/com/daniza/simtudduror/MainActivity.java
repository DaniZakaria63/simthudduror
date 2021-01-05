package com.daniza.simtudduror;

import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;

import android.os.Bundle;
import android.view.View;

import com.daniza.simtudduror.databinding.ActivityMainBinding;

public class MainActivity extends AppCompatActivity {

    private ActivityMainBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding=ActivityMainBinding.inflate(getLayoutInflater());
        View view=binding.getRoot();
        setContentView(view);

        gotoFragment(new HomeFragment(),null,false);
    }

    @Override
    protected void onResume() {
        //TODO: Tampilkan Iklan
        super.onResume();
    }

    @Override
    protected void onDestroy() {
        binding=null;
        super.onDestroy();
    }

    public void gotoFragment(Fragment fragment, Bundle bundle, boolean addToBackstack){
        fragment.setArguments(bundle);

        if(addToBackstack) {
            getSupportFragmentManager().beginTransaction()
                    .replace(binding.container.getId(), fragment)
                    .addToBackStack(null)
                    .commit();
        }else{
            getSupportFragmentManager().beginTransaction()
                    .replace(binding.container.getId(),fragment)
                    .commit();
        }
    }
}