package com.daniza.simtudduror;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import com.daniza.simtudduror.databinding.ListItemReadBinding;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

public class ListAdapter extends RecyclerView.Adapter<ListAdapter.ListViewHolder> {
    private String[] mList,mIconList;
    private Listener listener;

    interface Listener{
        void onClicked(int position);
    }
    public ListAdapter(String[] list,String[] iconList, Listener listener){
        this.mList=list;
        this.mIconList=iconList;
        this.listener=listener;
    }

    @NonNull
    @Override
    public ListViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ListItemReadBinding binding=ListItemReadBinding.inflate(LayoutInflater.from(parent.getContext()),parent,false);
        return new ListViewHolder(binding);
    }

    @Override
    public void onBindViewHolder(@NonNull ListViewHolder holder, int position) {
        holder.bind(mList[position],mIconList[position],position);
    }

    @Override
    public int getItemCount() {
        return mList.length;
    }

    public class ListViewHolder extends RecyclerView.ViewHolder {
        private ListItemReadBinding binding;
        public ListViewHolder(@NonNull ListItemReadBinding binding) {
            super(binding.getRoot());
            this.binding=binding;
        }
        public void bind(String name,String icon,int position){
            binding.tvReadListIcon.setText(icon);
            binding.tvReadListText.setText(name);
            binding.tvReadListText.setOnClickListener(v->{
                listener.onClicked(position);
            });
        }
    }
}
